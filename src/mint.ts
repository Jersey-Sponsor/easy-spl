import BN from 'bn.js'
import * as web3 from '@solana/web3.js'
import * as TokenInstructions from './token-instructions'
import { TOKEN_PROGRAM_ID, Token, MintInfo } from '@solana/spl-token'
import * as util from './util'
import { WalletI } from './types'
import * as account from './account'
import * as associatedTokenAccount from './associated-token-account'

export const createMintInstructions = async (
  conn: web3.Connection,
  decimals: number,
  mint: web3.PublicKey,
  authority: web3.PublicKey,
  signer: web3.PublicKey,
): Promise<web3.TransactionInstruction[]> => {
  return [
    web3.SystemProgram.createAccount({
      fromPubkey: signer,
      newAccountPubkey: mint,
      space: 82,
      lamports: await conn.getMinimumBalanceForRentExemption(82),
      programId: TOKEN_PROGRAM_ID,
    }),
    TokenInstructions.initializeMint({
      mint: mint,
      decimals: decimals,
      mintAuthority: authority,
    }),
  ];
}

export const createMintTx = async (
  conn: web3.Connection,
  decimals: number,
  mint: web3.PublicKey,
  authority: web3.PublicKey,
  signer: web3.PublicKey
): Promise<web3.Transaction> => {
  const instructions = await createMintInstructions(conn, decimals, mint, authority, signer)
  return util.wrapInstructions(conn, instructions, signer)
}

export const createMintSigned = async (
  conn: web3.Connection,
  decimals: number,
  mint: web3.PublicKey,
  authority: web3.PublicKey,
  wallet: WalletI
): Promise<web3.Transaction> => {
  const tx = await createMintTx(conn, decimals, mint, authority, wallet.publicKey)
  return await wallet.signTransaction(tx)
}

export const createMintSend = async (
  conn: web3.Connection,
  decimals: number,
  authority: web3.PublicKey,
  wallet: WalletI
): Promise<string> => {
  const mint = web3.Keypair.generate()
  const tx = await createMintSigned(conn, decimals, mint.publicKey, authority, wallet)
  return util.sendAndConfirm(conn, tx)
}


export const mintToRawInstructions = (
  mint: web3.PublicKey,
  dest: web3.PublicKey,
  authority: web3.PublicKey,
  amount: number
): web3.TransactionInstruction[] => {
  return [Token.createMintToInstruction(
    TOKEN_PROGRAM_ID,
    mint,
    dest,
    authority,
    [],
    amount
  )]
}

export const mintToTx = async (
  conn: web3.Connection,
  mint: web3.PublicKey,
  dest: web3.PublicKey,
  authority: web3.PublicKey,
  amount: number
): Promise<web3.Transaction> => {
  const associated = await associatedTokenAccount.get.address(mint, dest)
  const exists = await account.exists(conn, associated)
  const instructions = []
  if (!exists) {
    instructions.push(
      associatedTokenAccount.create.instructions(mint, associated, dest, authority)
    )
  }
  const mintDecimals = await getMintDecimals(conn, mint)
  const amountRaw = util.makeInteger(amount, mintDecimals).toNumber()
  instructions.push(
    mintToRawInstructions(mint, associated, authority, amountRaw)
  )
  return util.wrapInstructions(conn, instructions, authority)
}

export const mintToSigned = async (
  conn: web3.Connection,
  mint: web3.PublicKey,
  dest: web3.PublicKey,
  authority: WalletI,
  amount: number
): Promise<web3.Transaction> => {
  const tx = await mintToTx(conn, mint, dest, authority.publicKey, amount)
  return await authority.signTransaction(tx)
}

export const mintToSend = async (
  conn: web3.Connection,
  mint: web3.PublicKey,
  dest: web3.PublicKey,
  authority: WalletI,
  amount: number
): Promise<string> => {
  const tx = await mintToSigned(conn, mint, dest, authority, amount)
  return util.sendAndConfirm(conn, tx)
}

export const getMintInfo = async (
  conn: web3.Connection,
  mint: web3.PublicKey
): Promise<MintInfo> => {
  const token = new Token(conn, mint, TOKEN_PROGRAM_ID, {} as any)
  return token.getMintInfo()
}

export const getMintDecimals = async (
  conn: web3.Connection,
  mint: web3.PublicKey
): Promise<number> => {
  const info = await getMintInfo(conn, mint)
  return info.decimals
}

export const getMintSupplyRaw = async (
  conn: web3.Connection,
  mint: web3.PublicKey
): Promise<BN> => {
  const info = await getMintInfo(conn, mint)
  return info.supply
}

export const getMintSupply = async (
  conn: web3.Connection,
  mint: web3.PublicKey
): Promise<number> => {
  const info = await getMintInfo(conn, mint)
  return util.makeDecimal(info.supply, info.decimals)
}

export const create = {
  instructions: createMintInstructions,
  tx: createMintTx,
  signed: createMintSigned,
  send: createMintSend
}

export const get = {
  decimals: getMintDecimals,
  supply: getMintSupply,
  supplyRaw: getMintSupplyRaw
}

export const mintTo = {
  rawInstructions: mintToRawInstructions,
  tx: mintToTx,
  signed: mintToSigned,
  send: mintToSend
}
