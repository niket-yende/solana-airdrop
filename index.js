// Importing required libraries 
const cron = require("node-cron"); 
const express = require("express"); 
const { Connection, PublicKey, LAMPORTS_PER_SOL } = require("@solana/web3.js");

const master_address = "9b9wKu2EFnk3ZHHhDaudfxpqtDM2SM3uJL54dMpmXTYw";
  
app = express(); // Initializing app 
  
// Creating a cron job which runs on every 30 minutes
cron.schedule("*/30 * * * *", function() { 
    console.log("running a task every 30 min");
    airdrop(); 
}); 

airdrop = async () => {
    try {
        console.log(`Airdropping sol to ${master_address}`);
        const connection = new Connection("https://api.devnet.solana.com", "confirmed");
        const myAddress = new PublicKey(master_address);
        const signature = await connection.requestAirdrop(myAddress, LAMPORTS_PER_SOL);
        await connection.confirmTransaction(signature);
        // Log results
        console.log(`Tx Complete: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
        console.log('Airdrop complete');
    } catch(error) {
        console.error('Error caught during airdrop ', error);
    } 
};


app.listen(3000); 