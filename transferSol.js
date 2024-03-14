const {web3, Keypair, Connection, LAMPORTS_PER_SOL, SystemProgram, Transaction, sendAndConfirmTransaction, PublicKey, clusterApiUrl} = require("@solana/web3.js");
const dotenv = require("dotenv");

dotenv.config();

(async () => {
    // Connect to cluster
    var connection = new Connection(clusterApiUrl("devnet"), 'confirmed');
    // Construct a `Keypair` from secret key
    const secret = JSON.parse(process.env.PRIVATE_KEY ?? "");
    const fromAddress = Keypair.fromSecretKey(new Uint8Array(secret));
    console.log(`fromAddress: ${fromAddress.publicKey}`); // local-devnet

    const destinationSecret = JSON.parse(process.env.DEST_PRIVATE_KEY ?? "");
    const toAddress = Keypair.fromSecretKey(new Uint8Array(destinationSecret));
    console.log(`toAddress: ${toAddress.publicKey}`); // test

    const fromBalanceBefore = await connection.getBalance(fromAddress.publicKey);
    console.log(`fromBalanceBefore: ${fromBalanceBefore / LAMPORTS_PER_SOL} SOL`);

    const toBalanceBefore = await connection.getBalance(toAddress.publicKey);
    console.log(`toBalanceBefore: ${toBalanceBefore / LAMPORTS_PER_SOL} SOL`);
    
    // Calculate the lamports to transfer (0.5 SOL)
    const lamportsToSend = 0.5 * LAMPORTS_PER_SOL;

    // Add transfer instruction to transaction
    var transaction = new Transaction().add(
        SystemProgram.transfer({
            fromPubkey: fromAddress.publicKey,
            toPubkey: toAddress.publicKey,
            lamports: lamportsToSend, 
        })
    );
    // Sign transaction, broadcast, and confirm
    var signature = await sendAndConfirmTransaction(
        connection,
        transaction,
        [fromAddress]
    );
    console.log("SIGNATURE", signature);
    console.log("SUCCESS");

    // Check user's balance
    const fromBalanceAfter = await connection.getBalance(fromAddress.publicKey);
    console.log(`fromBalanceAfter: ${fromBalanceAfter / LAMPORTS_PER_SOL} SOL`);

    const toBalanceAfter = await connection.getBalance(toAddress.publicKey);
    console.log(`toBalanceAfter: ${toBalanceAfter / LAMPORTS_PER_SOL} SOL`);
})();