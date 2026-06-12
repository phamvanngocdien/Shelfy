/**
 * Public configuration — safe to commit to Git.
 * These are on-chain contract addresses, not secrets.
 */

/**
 * APT (Aptos Coin) — Native coin, same address on ALL networks:
 * 0x1::aptos_coin::AptosCoin
 * 
 * This is hardcoded in useAptosWallet.ts because it never changes.
 */

/** ShelbyUSD (SHD) token contract address per network */
export const SHD_TOKEN_ADDRESS: Record<string, string> = {
  mainnet: '0x1b18363a9f1fe5e6ebf247daba5cc1c18052bb232efdc4c50f556053922d98e1',
  testnet: '0x1b18363a9f1fe5e6ebf247daba5cc1c18052bb232efdc4c50f556053922d98e1',
  devnet: '',     // Chưa deploy — hiển thị 0
  custom: '',     // Shelbynet — bổ sung khi có
};
