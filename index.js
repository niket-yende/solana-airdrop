// Importing required libraries 
const cron = require("node-cron"); 
const express = require("express"); 
const { Connection, PublicKey, LAMPORTS_PER_SOL } = require("@solana/web3.js");

const WALLET_ADDRESS = '9b9wKu2EFnk3ZHHhDaudfxpqtDM2SM3uJL54dMpmXTYw'; //👈 Replace with your wallet address
const AIRDROP_AMOUNT = 1 * LAMPORTS_PER_SOL; // 1 SOL 
  
app = express(); // Initializing app 
  
// Creating a cron job which runs at minute 30 past every hour 
cron.schedule("30 */1 * * *", function() { 
    console.log("running a task every 30 min");
    airdrop(); 
}); 

airdrop = async () => {
    try {
        console.log(`Airdropping sol to ${WALLET_ADDRESS}`);
        const connection = new Connection("https://api.devnet.solana.com", "confirmed");
        const myAddress = new PublicKey(WALLET_ADDRESS);
        // 1 - Request Airdrop
        const signature = await connection.requestAirdrop(myAddress, AIRDROP_AMOUNT);
        // 2 - Fetch the latest blockhash
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        // 3 - Confirm transaction success
        await connection.confirmTransaction({
            blockhash,
            lastValidBlockHeight,
            signature
        },'finalized');
        // 4 - Log results
        console.log(`Tx Complete: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
        console.log('Airdrop complete');
    } catch(error) {
        console.error('Error caught during airdrop ', error);
    } 
};


app.listen(3000); 