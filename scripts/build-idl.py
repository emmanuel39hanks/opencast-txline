#!/usr/bin/env python3
"""Assemble the Anchor 0.30 IDL for opencast_settlement.

We build it by hand (instructions/accounts/types match lib.rs) and borrow the
TxLINE proof types (StatValidationInput + deps) from the txoracle IDL, since
settle_market takes a `payload: StatValidationInput`. Discriminators are
sha256("global:<ix>")[:8] and sha256("account:<Struct>")[:8].
"""
import hashlib
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROGRAM_ID = "4pCM1Xbd4qPEPjtV1YKNPi1P6j8TmfZ2mamwGc7FB2fU"


def disc(prefix, name):
    return list(hashlib.sha256(f"{prefix}:{name}".encode()).digest()[:8])


# Pull the proof types we need from the txoracle IDL.
tx = json.load(open(os.path.join(ROOT, "program/idls/txoracle.json")))
tx_types = {t["name"]: t for t in tx["types"]}
NEEDED = [
    "StatValidationInput",
    "ScoresBatchSummary",
    "ScoresUpdateStats",
    "ProofNode",
    "StatLeaf",
    "ScoreStat",
]
proof_types = [tx_types[n] for n in NEEDED]

market_type = {
    "name": "Market",
    "type": {
        "kind": "struct",
        "fields": [
            {"name": "creator", "type": "pubkey"},
            {"name": "seed", "type": "pubkey"},
            {"name": "fixture_id", "type": "i64"},
            {"name": "stat_key_a", "type": "u32"},
            {"name": "stat_key_b", "type": "u32"},
            {"name": "threshold", "type": "i32"},
            {"name": "comparison", "type": "u8"},
            {"name": "yes_pool", "type": "u64"},
            {"name": "no_pool", "type": "u64"},
            {"name": "outcome", "type": "u8"},
            {"name": "settled", "type": "bool"},
            {"name": "usdc_mint", "type": "pubkey"},
            {"name": "vault", "type": "pubkey"},
            {"name": "bump", "type": "u8"},
        ],
    },
}
position_type = {
    "name": "Position",
    "type": {
        "kind": "struct",
        "fields": [
            {"name": "market", "type": "pubkey"},
            {"name": "user", "type": "pubkey"},
            {"name": "yes_amount", "type": "u64"},
            {"name": "no_amount", "type": "u64"},
            {"name": "claimed", "type": "bool"},
            {"name": "bump", "type": "u8"},
        ],
    },
}


def acc(name, writable=False, signer=False, address=None):
    a = {"name": name}
    if writable:
        a["writable"] = True
    if signer:
        a["signer"] = True
    if address:
        a["address"] = address
    return a


TOKEN_PROG = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
ATA_PROG = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
SYS_PROG = "11111111111111111111111111111111"

instructions = [
    {
        "name": "create_market",
        "discriminator": disc("global", "create_market"),
        "accounts": [
            acc("creator", writable=True, signer=True),
            acc("market", writable=True),
            acc("usdc_mint"),
            acc("vault", writable=True),
            acc("creator_usdc", writable=True),
            acc("token_program", address=TOKEN_PROG),
            acc("associated_token_program", address=ATA_PROG),
            acc("system_program", address=SYS_PROG),
        ],
        "args": [
            {"name": "seed", "type": "pubkey"},
            {"name": "fixture_id", "type": "i64"},
            {"name": "stat_key_a", "type": "u32"},
            {"name": "stat_key_b", "type": "u32"},
            {"name": "threshold", "type": "i32"},
            {"name": "comparison", "type": "u8"},
            {"name": "seed_amount", "type": "u64"},
        ],
    },
    {
        "name": "place_prediction",
        "discriminator": disc("global", "place_prediction"),
        "accounts": [
            acc("user", writable=True, signer=True),
            acc("market", writable=True),
            acc("position", writable=True),
            acc("vault", writable=True),
            acc("user_usdc", writable=True),
            acc("token_program", address=TOKEN_PROG),
            acc("system_program", address=SYS_PROG),
        ],
        "args": [
            {"name": "side", "type": "u8"},
            {"name": "amount", "type": "u64"},
        ],
    },
    {
        "name": "settle_market",
        "discriminator": disc("global", "settle_market"),
        "accounts": [
            acc("keeper", writable=True, signer=True),
            acc("market", writable=True),
            acc("daily_scores_merkle_roots"),
            acc("txoracle_program", address=tx["address"]),
        ],
        "args": [
            {"name": "payload", "type": {"defined": {"name": "StatValidationInput"}}},
        ],
    },
    {
        "name": "claim",
        "discriminator": disc("global", "claim"),
        "accounts": [
            acc("user", writable=True, signer=True),
            acc("market"),
            acc("position", writable=True),
            acc("vault", writable=True),
            acc("user_usdc", writable=True),
            acc("token_program", address=TOKEN_PROG),
        ],
        "args": [],
    },
]

errors = [
    {"code": 6000, "name": "AlreadySettled", "msg": "Market already settled"},
    {"code": 6001, "name": "NotSettled", "msg": "Market not settled yet"},
    {"code": 6002, "name": "ZeroAmount", "msg": "Amount must be greater than zero"},
    {"code": 6003, "name": "BadSide", "msg": "Side must be 1 (YES) or 2 (NO)"},
    {"code": 6004, "name": "BadComparison", "msg": "Comparison must be 0, 1 or 2"},
    {"code": 6005, "name": "FixtureMismatch", "msg": "Proof fixture does not match this market"},
    {"code": 6006, "name": "AlreadyClaimed", "msg": "Position already claimed"},
    {"code": 6007, "name": "NoWinnings", "msg": "No winnings to claim"},
]

idl = {
    "address": PROGRAM_ID,
    "metadata": {"name": "opencast_settlement", "version": "0.1.0", "spec": "0.1.0"},
    "instructions": instructions,
    "accounts": [
        {"name": "Market", "discriminator": disc("account", "Market")},
        {"name": "Position", "discriminator": disc("account", "Position")},
    ],
    "errors": errors,
    "types": [market_type, position_type] + proof_types,
}

out_dirs = [
    os.path.join(ROOT, "program/idl"),
    os.path.join(ROOT, "lib/solana"),
]
for d in out_dirs:
    os.makedirs(d, exist_ok=True)
    json.dump(idl, open(os.path.join(d, "opencast_settlement.json"), "w"), indent=2)

print("IDL written to program/idl/ and lib/solana/")
print("instructions:", [i["name"] for i in instructions])
print("types:", [t["name"] for t in idl["types"]])
