use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

// Generate a CPI client + types from TxLINE's txoracle IDL (idls/txoracle.json).
declare_program!(txoracle);
use txoracle::types::{
    BinaryExpression, Comparison, NDimensionalStrategy, StatPredicate,
    StatValidationInput, TraderPredicate,
};

declare_id!("4pCM1Xbd4qPEPjtV1YKNPi1P6j8TmfZ2mamwGc7FB2fU");

/// Platform fee (basis points) skimmed from each winning payout.
const PLATFORM_FEE_BPS: u128 = 200; // 2%

/// Max legs in a parlay (bounded by the u8 result/evaluated bitmaps).
const MAX_LEGS: usize = 8;

/// Hard cap on a single ticket's payout (safety bound on treasury exposure).
const MAX_PAYOUT: u64 = 100_000_000_000; // 100k USDC

#[program]
pub mod opencast_settlement {
    use super::*;

    /// Create a World Cup market bound to a TxLINE fixture + a YES-condition
    /// predicate over match stats. Optionally seeds initial liquidity.
    ///
    /// The YES condition is stored on-chain so settlement can't be steered by
    /// whoever submits the proof: `stat_key_a` (and optional `stat_key_b`) name
    /// the TxLINE ScoreStat keys; the predicate is `(a [- b]) <cmp> threshold`.
    /// e.g. home win = keys (1,2), Subtract, GreaterThan, threshold 0.
    pub fn create_market(
        ctx: Context<CreateMarket>,
        seed: Pubkey,
        fixture_id: i64,
        stat_key_a: u32,
        stat_key_b: u32, // 0 => single-stat predicate
        threshold: i32,
        comparison: u8, // 0 = GreaterThan, 1 = LessThan, 2 = EqualTo
        seed_amount: u64,
    ) -> Result<()> {
        require!(comparison <= 2, OcError::BadComparison);

        let m = &mut ctx.accounts.market;
        m.creator = ctx.accounts.creator.key();
        m.seed = seed;
        m.fixture_id = fixture_id;
        m.stat_key_a = stat_key_a;
        m.stat_key_b = stat_key_b;
        m.threshold = threshold;
        m.comparison = comparison;
        m.yes_pool = 0;
        m.no_pool = 0;
        m.outcome = 0;
        m.settled = false;
        m.usdc_mint = ctx.accounts.usdc_mint.key();
        m.vault = ctx.accounts.vault.key();
        m.bump = ctx.bumps.market;

        if seed_amount > 0 {
            token::transfer(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.creator_usdc.to_account_info(),
                        to: ctx.accounts.vault.to_account_info(),
                        authority: ctx.accounts.creator.to_account_info(),
                    },
                ),
                seed_amount,
            )?;
            // Split the creator's seed evenly across both sides.
            let half = seed_amount / 2;
            m.yes_pool = half;
            m.no_pool = seed_amount - half;
        }
        Ok(())
    }

    /// Like `create_market`, but opens the book at a chosen probability
    /// instead of 50/50: `yes_bps` of the seed goes to the YES pool (basis
    /// points, clamped so neither side opens empty). Used to open markets at
    /// TxODDS' professional line. Same accounts, no state-layout changes.
    pub fn create_market_split(
        ctx: Context<CreateMarket>,
        seed: Pubkey,
        fixture_id: i64,
        stat_key_a: u32,
        stat_key_b: u32,
        threshold: i32,
        comparison: u8,
        seed_amount: u64,
        yes_bps: u16,
    ) -> Result<()> {
        require!(comparison <= 2, OcError::BadComparison);
        require!((500..=9500).contains(&yes_bps), OcError::BadSplit);

        let m = &mut ctx.accounts.market;
        m.creator = ctx.accounts.creator.key();
        m.seed = seed;
        m.fixture_id = fixture_id;
        m.stat_key_a = stat_key_a;
        m.stat_key_b = stat_key_b;
        m.threshold = threshold;
        m.comparison = comparison;
        m.yes_pool = 0;
        m.no_pool = 0;
        m.outcome = 0;
        m.settled = false;
        m.usdc_mint = ctx.accounts.usdc_mint.key();
        m.vault = ctx.accounts.vault.key();
        m.bump = ctx.bumps.market;

        if seed_amount > 0 {
            token::transfer(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.creator_usdc.to_account_info(),
                        to: ctx.accounts.vault.to_account_info(),
                        authority: ctx.accounts.creator.to_account_info(),
                    },
                ),
                seed_amount,
            )?;
            let yes = (seed_amount as u128) * (yes_bps as u128) / 10_000;
            m.yes_pool = yes as u64;
            m.no_pool = seed_amount - (yes as u64);
        }
        Ok(())
    }

    /// Stake USDC on YES (1) or NO (2). Funds go into the market vault; the
    /// caller's position accrues.
    pub fn place_prediction(
        ctx: Context<PlacePrediction>,
        side: u8,
        amount: u64,
    ) -> Result<()> {
        require!(!ctx.accounts.market.settled, OcError::AlreadySettled);
        require!(amount > 0, OcError::ZeroAmount);
        require!(side == 1 || side == 2, OcError::BadSide);

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.user_usdc.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            amount,
        )?;

        let m = &mut ctx.accounts.market;
        let p = &mut ctx.accounts.position;
        p.market = m.key();
        p.user = ctx.accounts.user.key();
        p.bump = ctx.bumps.position;
        if side == 1 {
            p.yes_amount = p.yes_amount.saturating_add(amount);
            m.yes_pool = m.yes_pool.saturating_add(amount);
        } else {
            p.no_amount = p.no_amount.saturating_add(amount);
            m.no_pool = m.no_pool.saturating_add(amount);
        }
        Ok(())
    }

    /// Settle trustlessly: CPI into txoracle.validate_stat_v2 with the caller's
    /// TxLINE Merkle proof and the market's stored YES-condition. The proof is
    /// verified on-chain against the published daily-scores root, and we bind it
    /// to this market's fixture, so no one can steer the outcome.
    pub fn settle_market(
        ctx: Context<SettleMarket>,
        payload: StatValidationInput,
    ) -> Result<()> {
        let m = &mut ctx.accounts.market;
        require!(!m.settled, OcError::AlreadySettled);
        require!(
            payload.fixture_summary.fixture_id == m.fixture_id,
            OcError::FixtureMismatch
        );

        let comparison = match m.comparison {
            0 => Comparison::GreaterThan,
            1 => Comparison::LessThan,
            _ => Comparison::EqualTo,
        };
        let predicate = TraderPredicate {
            threshold: m.threshold,
            comparison,
        };
        let discrete = if m.stat_key_b == 0 {
            StatPredicate::Single {
                index: 0,
                predicate,
            }
        } else {
            StatPredicate::Binary {
                index_a: 0,
                index_b: 1,
                op: BinaryExpression::Subtract,
                predicate,
            }
        };
        let strategy = NDimensionalStrategy {
            geometric_targets: vec![],
            distance_predicate: None,
            discrete_predicates: vec![discrete],
        };

        let cpi = CpiContext::new(
            ctx.accounts.txoracle_program.to_account_info(),
            txoracle::cpi::accounts::ValidateStatV2 {
                daily_scores_merkle_roots: ctx
                    .accounts
                    .daily_scores_merkle_roots
                    .to_account_info(),
            },
        );
        let is_yes = txoracle::cpi::validate_stat_v2(cpi, payload, strategy)?.get();

        m.outcome = if is_yes { 1 } else { 2 };
        m.settled = true;
        Ok(())
    }

    /// Winners claim their pro-rata share of the total pool, minus the platform
    /// fee. Payout = stake * total / winning_pool, then − fee.
    pub fn claim(ctx: Context<Claim>) -> Result<()> {
        let m = &ctx.accounts.market;
        require!(m.settled, OcError::NotSettled);
        let p = &mut ctx.accounts.position;
        require!(!p.claimed, OcError::AlreadyClaimed);

        let (winner_pool, stake) = if m.outcome == 1 {
            (m.yes_pool, p.yes_amount)
        } else {
            (m.no_pool, p.no_amount)
        };
        require!(stake > 0 && winner_pool > 0, OcError::NoWinnings);

        let total = (m.yes_pool as u128) + (m.no_pool as u128);
        let gross = (stake as u128) * total / (winner_pool as u128);
        let fee = gross * PLATFORM_FEE_BPS / 10_000;
        let payout = (gross - fee) as u64;

        let seed = m.seed;
        let bump = m.bump;
        let signer: &[&[&[u8]]] = &[&[b"market", seed.as_ref(), &[bump]]];
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.user_usdc.to_account_info(),
                    authority: ctx.accounts.market.to_account_info(),
                },
                signer,
            ),
            payout,
        )?;
        p.claimed = true;
        Ok(())
    }

    // ─── Parlays (provable, fixed-odds multi-pick tickets) ───────────────────
    //
    // A parlay is a USER's own ticket bundling N picks from across matches. You
    // stake once at a fixed multiplier (quoted from live market prices); the
    // ticket pays `payout` from the platform treasury ONLY if every pick's
    // TxLINE stat proof holds. Each leg is proven in its own tx and AND-ed
    // on-chain, so no leg can be skipped or faked. Losing stakes fund the
    // treasury that pays winners — settlement stays fully trustless.

    /// One-time: create the treasury + its USDC vault (the parlay bankroll).
    pub fn init_treasury(ctx: Context<InitTreasury>) -> Result<()> {
        let t = &mut ctx.accounts.treasury;
        t.usdc_mint = ctx.accounts.usdc_mint.key();
        t.vault = ctx.accounts.vault.key();
        t.reserved = 0;
        t.bump = ctx.bumps.treasury;
        Ok(())
    }

    /// Place a parlay ticket: lock `stake` into the treasury against a fixed
    /// `payout` (stake × combined multiplier, quoted off-chain from live market
    /// prices). Requires the treasury can already cover the payout.
    pub fn place_parlay(
        ctx: Context<PlaceParlay>,
        id: Pubkey,
        legs: Vec<Leg>,
        stake: u64,
        payout: u64,
    ) -> Result<()> {
        require!(legs.len() >= 2 && legs.len() <= MAX_LEGS, OcError::BadLegCount);
        for l in &legs {
            require!(l.comparison <= 2, OcError::BadComparison);
            require!(l.expected <= 1, OcError::BadSide);
        }
        require!(stake > 0, OcError::ZeroAmount);
        require!(payout >= stake && payout <= MAX_PAYOUT, OcError::BadPayout);
        // The vault must cover this payout ON TOP of every payout already
        // promised to open / unclaimed tickets.
        let t = &mut ctx.accounts.treasury;
        let liable = t
            .reserved
            .checked_add(payout)
            .ok_or(OcError::BadPayout)?;
        require!(ctx.accounts.vault.amount >= liable, OcError::TreasuryTooThin);
        t.reserved = liable;

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.user_usdc.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            stake,
        )?;

        let b = &mut ctx.accounts.bet;
        b.owner = ctx.accounts.user.key();
        b.id = id;
        b.legs = legs;
        b.stake = stake;
        b.payout = payout;
        b.evaluated = 0;
        b.passed = 0;
        b.settled = false;
        b.won = false;
        b.claimed = false;
        b.bump = ctx.bumps.bet;
        Ok(())
    }

    /// Prove one leg of a parlay ticket against its own TxLINE proof. A leg
    /// "holds" if the proven truth matches the side the ticket needs.
    pub fn prove_leg(
        ctx: Context<ProveLeg>,
        leg_index: u8,
        payload: StatValidationInput,
    ) -> Result<()> {
        let b = &mut ctx.accounts.bet;
        require!(!b.settled, OcError::AlreadySettled);
        let i = leg_index as usize;
        require!(i < b.legs.len(), OcError::BadLegIndex);
        let bit = 1u8 << leg_index;
        require!(b.evaluated & bit == 0, OcError::LegAlreadyEvaluated);

        let leg = b.legs[i].clone();
        require!(
            payload.fixture_summary.fixture_id == leg.fixture_id,
            OcError::FixtureMismatch
        );

        let comparison = match leg.comparison {
            0 => Comparison::GreaterThan,
            1 => Comparison::LessThan,
            _ => Comparison::EqualTo,
        };
        let predicate = TraderPredicate {
            threshold: leg.threshold,
            comparison,
        };
        let discrete = if leg.stat_key_b == 0 {
            StatPredicate::Single {
                index: 0,
                predicate,
            }
        } else {
            StatPredicate::Binary {
                index_a: 0,
                index_b: 1,
                op: BinaryExpression::Subtract,
                predicate,
            }
        };
        let strategy = NDimensionalStrategy {
            geometric_targets: vec![],
            distance_predicate: None,
            discrete_predicates: vec![discrete],
        };

        let cpi = CpiContext::new(
            ctx.accounts.txoracle_program.to_account_info(),
            txoracle::cpi::accounts::ValidateStatV2 {
                daily_scores_merkle_roots: ctx
                    .accounts
                    .daily_scores_merkle_roots
                    .to_account_info(),
            },
        );
        let is_true = txoracle::cpi::validate_stat_v2(cpi, payload, strategy)?.get();

        b.evaluated |= bit;
        if is_true == (leg.expected == 1) {
            b.passed |= bit;
        }
        Ok(())
    }

    /// Once every leg is proven, settle the ticket: won iff all legs held.
    pub fn finalize_parlay(ctx: Context<FinalizeParlay>) -> Result<()> {
        let b = &mut ctx.accounts.bet;
        require!(!b.settled, OcError::AlreadySettled);
        let n = b.legs.len() as u32;
        let full: u8 = if n >= 8 { 0xFF } else { ((1u32 << n) - 1) as u8 };
        require!(b.evaluated == full, OcError::LegsNotAllEvaluated);
        b.won = b.passed == full;
        b.settled = true;
        if !b.won {
            // Losing ticket: its payout is no longer owed — release it.
            let t = &mut ctx.accounts.treasury;
            t.reserved = t.reserved.saturating_sub(b.payout);
        }
        Ok(())
    }

    /// A winning ticket pays `payout` from the treasury to its owner.
    pub fn claim_parlay(ctx: Context<ClaimParlay>) -> Result<()> {
        let b = &mut ctx.accounts.bet;
        require!(b.settled, OcError::NotSettled);
        require!(b.won, OcError::NoWinnings);
        require!(!b.claimed, OcError::AlreadyClaimed);
        require!(ctx.accounts.vault.amount >= b.payout, OcError::TreasuryTooThin);

        let bump = ctx.accounts.treasury.bump;
        let signer: &[&[&[u8]]] = &[&[b"treasury_v2", &[bump]]];
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.user_usdc.to_account_info(),
                    authority: ctx.accounts.treasury.to_account_info(),
                },
                signer,
            ),
            b.payout,
        )?;
        b.claimed = true;
        let t = &mut ctx.accounts.treasury;
        t.reserved = t.reserved.saturating_sub(b.payout);
        Ok(())
    }
}

// ─── Accounts ───────────────────────────────────────────────────────────────

#[account]
pub struct Market {
    pub creator: Pubkey,
    pub seed: Pubkey,
    pub fixture_id: i64,
    pub stat_key_a: u32,
    pub stat_key_b: u32,
    pub threshold: i32,
    pub comparison: u8,
    pub yes_pool: u64,
    pub no_pool: u64,
    pub outcome: u8, // 0 unresolved, 1 YES, 2 NO
    pub settled: bool,
    pub usdc_mint: Pubkey,
    pub vault: Pubkey,
    pub bump: u8,
}
impl Market {
    pub const SIZE: usize = 32 + 32 + 8 + 4 + 4 + 4 + 1 + 8 + 8 + 1 + 1 + 32 + 32 + 1;
}

#[account]
pub struct Position {
    pub market: Pubkey,
    pub user: Pubkey,
    pub yes_amount: u64,
    pub no_amount: u64,
    pub claimed: bool,
    pub bump: u8,
}
impl Position {
    pub const SIZE: usize = 32 + 32 + 8 + 8 + 1 + 1;
}

/// One leg of a parlay: a single provable TxLINE stat predicate on a fixture,
/// plus the side the ticket needs (`expected` = 1 for YES / true, 0 for NO).
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct Leg {
    pub fixture_id: i64,
    pub stat_key_a: u32,
    pub stat_key_b: u32,
    pub threshold: i32,
    pub comparison: u8,
    pub expected: u8,
}
impl Leg {
    pub const SIZE: usize = 8 + 4 + 4 + 4 + 1 + 1; // 22
}

/// The parlay bankroll: a USDC vault that takes losing stakes and pays winners.
#[account]
pub struct Treasury {
    pub usdc_mint: Pubkey,
    pub vault: Pubkey,
    /// Sum of outstanding payouts (open or won-but-unclaimed tickets). The
    /// vault must always cover this, so no ticket can be promised funds that
    /// another ticket already claims.
    pub reserved: u64,
    pub bump: u8,
}
impl Treasury {
    pub const SIZE: usize = 32 + 32 + 8 + 1;
}

/// A user's parlay ticket: N picks, a fixed stake + payout, proven leg-by-leg.
#[account]
pub struct ParlayBet {
    pub owner: Pubkey,
    pub id: Pubkey,
    pub legs: Vec<Leg>,
    pub stake: u64,
    pub payout: u64,
    pub evaluated: u8, // bitmap of proven legs
    pub passed: u8,    // bitmap of legs that held
    pub settled: bool,
    pub won: bool,
    pub claimed: bool,
    pub bump: u8,
}
impl ParlayBet {
    pub const SIZE: usize =
        32 + 32 + 4 + MAX_LEGS * Leg::SIZE + 8 + 8 + 1 + 1 + 1 + 1 + 1 + 1;
}

#[derive(Accounts)]
#[instruction(seed: Pubkey)]
pub struct CreateMarket<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,
    #[account(
        init,
        payer = creator,
        space = 8 + Market::SIZE,
        seeds = [b"market", seed.as_ref()],
        bump
    )]
    pub market: Account<'info, Market>,
    pub usdc_mint: Account<'info, Mint>,
    #[account(
        init,
        payer = creator,
        associated_token::mint = usdc_mint,
        associated_token::authority = market
    )]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut, token::mint = usdc_mint, token::authority = creator)]
    pub creator_usdc: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PlacePrediction<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut, seeds = [b"market", market.seed.as_ref()], bump = market.bump)]
    pub market: Account<'info, Market>,
    #[account(
        init_if_needed,
        payer = user,
        space = 8 + Position::SIZE,
        seeds = [b"position", market.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub position: Account<'info, Position>,
    #[account(mut, address = market.vault)]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut, token::mint = market.usdc_mint, token::authority = user)]
    pub user_usdc: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SettleMarket<'info> {
    #[account(mut)]
    pub keeper: Signer<'info>,
    #[account(mut, seeds = [b"market", market.seed.as_ref()], bump = market.bump)]
    pub market: Account<'info, Market>,
    /// CHECK: TxLINE daily-scores root PDA; validated inside the CPI.
    pub daily_scores_merkle_roots: UncheckedAccount<'info>,
    /// CHECK: the TxLINE txoracle program (address checked via declare_program).
    #[account(address = txoracle::ID)]
    pub txoracle_program: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct Claim<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(seeds = [b"market", market.seed.as_ref()], bump = market.bump)]
    pub market: Account<'info, Market>,
    #[account(
        mut,
        seeds = [b"position", market.key().as_ref(), user.key().as_ref()],
        bump = position.bump
    )]
    pub position: Account<'info, Position>,
    #[account(mut, address = market.vault)]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut, token::mint = market.usdc_mint, token::authority = user)]
    pub user_usdc: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct InitTreasury<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(init, payer = payer, space = 8 + Treasury::SIZE, seeds = [b"treasury_v2"], bump)]
    pub treasury: Account<'info, Treasury>,
    pub usdc_mint: Account<'info, Mint>,
    #[account(
        init,
        payer = payer,
        associated_token::mint = usdc_mint,
        associated_token::authority = treasury
    )]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(id: Pubkey)]
pub struct PlaceParlay<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        init,
        payer = user,
        space = 8 + ParlayBet::SIZE,
        seeds = [b"pbet", user.key().as_ref(), id.as_ref()],
        bump
    )]
    pub bet: Account<'info, ParlayBet>,
    #[account(mut, seeds = [b"treasury_v2"], bump = treasury.bump)]
    pub treasury: Account<'info, Treasury>,
    #[account(mut, address = treasury.vault)]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut, token::mint = treasury.usdc_mint, token::authority = user)]
    pub user_usdc: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ProveLeg<'info> {
    #[account(mut)]
    pub keeper: Signer<'info>,
    #[account(mut, seeds = [b"pbet", bet.owner.as_ref(), bet.id.as_ref()], bump = bet.bump)]
    pub bet: Account<'info, ParlayBet>,
    /// CHECK: TxLINE daily-scores root PDA; validated inside the CPI.
    pub daily_scores_merkle_roots: UncheckedAccount<'info>,
    /// CHECK: the TxLINE txoracle program (address checked via declare_program).
    #[account(address = txoracle::ID)]
    pub txoracle_program: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct FinalizeParlay<'info> {
    #[account(mut)]
    pub keeper: Signer<'info>,
    #[account(mut, seeds = [b"pbet", bet.owner.as_ref(), bet.id.as_ref()], bump = bet.bump)]
    pub bet: Account<'info, ParlayBet>,
    #[account(mut, seeds = [b"treasury_v2"], bump = treasury.bump)]
    pub treasury: Account<'info, Treasury>,
}

#[derive(Accounts)]
pub struct ClaimParlay<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [b"pbet", user.key().as_ref(), bet.id.as_ref()],
        bump = bet.bump,
        constraint = bet.owner == user.key() @ OcError::NotCreator
    )]
    pub bet: Account<'info, ParlayBet>,
    #[account(mut, seeds = [b"treasury_v2"], bump = treasury.bump)]
    pub treasury: Account<'info, Treasury>,
    #[account(mut, address = treasury.vault)]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut, token::mint = treasury.usdc_mint, token::authority = user)]
    pub user_usdc: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[error_code]
pub enum OcError {
    #[msg("Market already settled")]
    AlreadySettled,
    #[msg("Market not settled yet")]
    NotSettled,
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    #[msg("Side must be 1 (YES) or 2 (NO)")]
    BadSide,
    #[msg("Comparison must be 0, 1 or 2")]
    BadComparison,
    #[msg("Opening split must be between 500 and 9500 bps")]
    BadSplit,
    #[msg("Proof fixture does not match this market")]
    FixtureMismatch,
    #[msg("Position already claimed")]
    AlreadyClaimed,
    #[msg("No winnings to claim")]
    NoWinnings,
    #[msg("A parlay needs 2..=8 legs")]
    BadLegCount,
    #[msg("Only the market creator can define the parlay")]
    NotCreator,
    #[msg("Leg index out of range")]
    BadLegIndex,
    #[msg("Leg already evaluated")]
    LegAlreadyEvaluated,
    #[msg("Not all legs have been evaluated yet")]
    LegsNotAllEvaluated,
    #[msg("Payout must be within [stake, MAX_PAYOUT]")]
    BadPayout,
    #[msg("Treasury cannot cover this payout")]
    TreasuryTooThin,
}
