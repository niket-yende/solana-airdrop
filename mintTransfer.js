const { clusterApiUrl, Connection, Keypair, LAMPORTS_PER_SOL } = require("@solana/web3.js");
const { createMint, getOrCreateAssociatedTokenAccount, mintTo, transfer, burnChecked, getAccount } = require('@solana/spl-token');

// const SECRET_KEY_ARRAY = []; // contains the private key of wallet account
// const DEMO_WALLET_SECRET_KEY = new Uint8Array(SECRET_KEY_ARRAY);

/**
 * Script to test tx fee payment through master account address.
 */
(async () => {
    // Connect to cluster
    const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');

    // console.log(`Master address: ${WALLET_ADDRESS}`);
    // const masterAddress = Keypair.fromSecretKey(DEMO_WALLET_SECRET_KEY);
    
    // Generate a new wallet keypair and airdrop SOL
    const masterAddress = Keypair.generate();
    console.log(`masterAddress: ${masterAddress.publicKey.toBase58()}`);
    const fromAirdropSignature = await connection.requestAirdrop(masterAddress.publicKey, LAMPORTS_PER_SOL);

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

    // Wait for airdrop confirmation
    await connection.confirmTransaction({
        blockhash,
        lastValidBlockHeight,
        fromAirdropSignature
    },'finalized');
    // Log results
    console.log(`Tx Complete: https://explorer.solana.com/tx/${fromAirdropSignature}?cluster=devnet`);

    // Generate a new wallet keypair and airdrop SOL
    const fromWallet = Keypair.generate();
    console.log(`fromWallet: ${fromWallet.publicKey.toBase58()}`);

    // Generate a new wallet to receive newly minted token
    const toWallet = Keypair.generate();
    console.log(`toWallet: ${toWallet.publicKey.toBase58()}`);

    // Create new token mint
    const mint = await createMint(
        connection, 
        masterAddress, // payer
        fromWallet.publicKey, // mintAuthority   
        fromWallet.publicKey, // freezeAuthority 
        9
    );
    console.log('Step1');

    // Get the token account of the fromWallet address, and if it does not exist, create it
    const fromTokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        masterAddress, // payer
        mint,
        fromWallet.publicKey
    );
    console.log('Step2');

    // Get the token account of the toWallet address, and if it does not exist, create it
    const toTokenAccount = await getOrCreateAssociatedTokenAccount(
        connection, 
        masterAddress, // payer 
        mint, 
        toWallet.publicKey
    );

    console.log('Step3');

    // Mint 1 new token to the "fromTokenAccount" account we just created
    let signature = await mintTo(
        connection,
        masterAddress, // payer
        mint,
        fromTokenAccount.address, // destination
        fromWallet, // mintAuthority
        1000000000
    );
    console.log(`Mint tx Complete: https://explorer.solana.com/tx/${signature}?cluster=devnet`);

    // Transfer the new token to the "toTokenAccount" we just created
    signature = await transfer(
        connection,
        masterAddress, // payer
        fromTokenAccount.address, // Source account
        toTokenAccount.address, // Destination account
        fromWallet,
        50
    );
    console.log(`Transfer tx Complete: https://explorer.solana.com/tx/${signature}?cluster=devnet`);

    const burnAmount = BigInt(2);
    signature = await burnChecked(
        connection,
        masterAddress, // payer
        toTokenAccount.address, // Account to burn tokens from
        mint, // Mint for the account
        toWallet, // Account owner
        burnAmount, // Amount to burn
        9
    );
    console.log(`Burn tx Complete: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
    
    const accountInfo = await getAccount(connection, toTokenAccount.address);
    // expect(accountInfo.amount).to.eql(amount - burnAmount);
    console.log(`AccountInfo amount: ${accountInfo.amount}`);
})();