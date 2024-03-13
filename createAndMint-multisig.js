const dotenv = require("dotenv");
const { mplTokenMetadata, TokenStandard, createAndMint, fetchAllDigitalAssetWithTokenByOwner, transferV1 } = require("@metaplex-foundation/mpl-token-metadata");
const { Connection, clusterApiUrl, Keypair, Transaction, PublicKey } = require("@solana/web3.js");
const { createNoopSigner, signerIdentity, percentAmount } = require('@metaplex-foundation/umi');
const { createUmi } = require('@metaplex-foundation/umi-bundle-defaults');
const { toWeb3JsTransaction } = require("@metaplex-foundation/umi-web3js-adapters");
const { nftStorageUploader } = require("@metaplex-foundation/umi-uploader-nft-storage");
const { createMultisig, createTransferInstruction, TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } = require("@solana/spl-token");

dotenv.config();

const sftData = {
  name: "Monkey",
  symbol: "M-SFT",
  description: "Monkey semi fungible token",
  sellerFeeBasisPoints: 15.99,
  imageFile: "sft_monkey.jpg"
}

/**
 * Reference: https://solana.stackexchange.com/questions/5004/how-to-properly-serialize-and-deserialize-versioned-transaction
 * https://developers.metaplex.com/token-metadata/mint
 * https://developers.metaplex.com/token-metadata/token-standard
 * https://developers.metaplex.com/umi/public-keys-and-signers#signers
 * https://github.com/metaplex-foundation/umi/blob/0f59ec298d52487eb04f5c7912e2317bb6b10ac2/packages/umi/test/TransactionBuilder.test.ts#L139C3-L148C5
 */
async function main() {
    // create a new connection to the cluster's API
    const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
    console.log(`cluster: ${clusterApiUrl('devnet')}`);

    // Use the RPC endpoint of your choice.
    const umi = createUmi('https://api.devnet.solana.com')
    .use(nftStorageUploader({token: process.env.NFT_STORAGE_TOKEN}))
    .use(mplTokenMetadata());

    const secret = JSON.parse(process.env.PRIVATE_KEY ?? "");
    const payer = Keypair.fromSecretKey(new Uint8Array(secret));
    
    console.log(`payer public key: ${payer.publicKey}`);

    const mintWallet = Keypair.generate();
    const mintAddress = mintWallet.publicKey.toString();
    console.log(`mintAddress: ${mintAddress}`); 
    const mint = createNoopSigner(mintAddress);
    
    const sourceWallet = Keypair.generate(); 
    console.log(`sourceWallet: ${sourceWallet.publicKey}`);
    
    const signer1 = Keypair.generate();
    console.log(`signer1: ${signer1.publicKey}`);
    const signer1PublicKey = createNoopSigner(signer1.publicKey.toString());
    const signer2 = Keypair.generate(); 
    console.log(`signer2: ${signer2.publicKey}`);
    const signer2PublicKey = createNoopSigner(signer2.publicKey.toString());
    const signer3 = Keypair.generate();
    console.log(`signer3: ${signer3.publicKey}`);
    const signer3PublicKey = createNoopSigner(signer3.publicKey.toString());
    
    console.log(`Assigning sourceWAllet as signerIdentity`);

    umi.use(signerIdentity(createNoopSigner(sourceWallet.publicKey), false));
    umi.payer = createNoopSigner(payer.publicKey);

    console.log('Step1');

    const builderIx = createAndMint(umi, 
        {
            mint: mint,
            name: sftData.name,
            uri: 'https://nftstorage.link/ipfs/bafkreidv3kcoygyw23e2zsdv7wktr3pbpoq3qtv4u7rnumy6uhyajxoj7q',
            amount: 20000000,
            sellerFeeBasisPoints: percentAmount(sftData.sellerFeeBasisPoints, 2),
            symbol: sftData.symbol,
            tokenStandard: TokenStandard.FungibleAsset,
            tokenOwner: sourceWallet.publicKey,
            creators: [{
              address: sourceWallet.publicKey,
              verified: false,
              share: 70,
            },
            {
              address: signer1.publicKey,
              verified: false,
              share: 10,
            },
            {
              address: signer2.publicKey,
              verified: false,
              share: 10,
            },
            {
              address: signer3.publicKey,
              verified: false,
              share: 10,
            }],
        }
    ).addRemainingAccounts(
      [
        {
          signer: signer1PublicKey,
          isWritable: false,
        },
        {
          signer: signer2PublicKey,
          isWritable: false,
        },
        {
          signer: signer3PublicKey,
          isWritable: false,
        },
      ],
      0
    ).getInstructions();

    console.log('Step2');

    let latestBlockhash = await umi.rpc.getLatestBlockhash();
    let umiTransaction = umi.transactions.create({
      version: 0,
      payer: payer.publicKey,
      instructions: builderIx,
      blockhash: latestBlockhash.blockhash,
    });

    let transaction = toWeb3JsTransaction(umiTransaction);
    
    console.log('Step3');
    
    // Sign the Transaction with the signer's private key
    transaction.sign([payer, mintWallet, sourceWallet, signer1, signer2, signer3]);
    let signedTransactionData = transaction.serialize();
    let txnSignature = await connection.sendRawTransaction(
      Buffer.from(signedTransactionData, 'base64')
    );

    console.log(`txnSignature: ${txnSignature}`);
    
    console.log('step4');

    const signer_mult1 = Keypair.generate();
    console.log(`signer_mult1: ${signer_mult1.publicKey}`);
    const signer_mult2 = Keypair.generate(); 
    console.log(`signer_mult2: ${signer_mult2.publicKey}`);
    const signer_mult3 = Keypair.generate();
    console.log(`signer_mult3: ${signer_mult3.publicKey}`);  

    const multisigKey1 = await createMultisig(
      connection,
      payer,
      [
        signer_mult1.publicKey,
        signer_mult2.publicKey,
        signer_mult3.publicKey
      ],
      2
    );
    
    console.log(`Created 2/3 multisig1 ${multisigKey1.toBase58()}`);

    const fromPublicKey = sourceWallet.publicKey;
    const fromTokenAccount = await connection.getTokenAccountsByOwner(
      fromPublicKey,
      {
        mint: mintWallet.publicKey,
      }
    );
    const fromTokenAccountAddress = fromTokenAccount.value[0].pubkey;
    console.log(
      `Token Transfer: fromTokenAccountAddress ${fromTokenAccountAddress}`
    );

    // create associated token addresssourceTokenAccountAddress
    await createAssociatedTokenAddress(connection, payer, multisigKey1, mintWallet);

    console.log(`Transferring token to multisig1 ${multisigKey1.toBase58()}`);
    console.log('-----------------------Transfer 1 starts--------------------'); 
    const transferIx1 = transferV1(umi, {
      mint,
      authority: createNoopSigner(sourceWallet.publicKey),
      tokenOwner: sourceWallet.publicKey,
      destinationOwner: multisigKey1,
      amount: 20000,
      tokenStandard: TokenStandard.FungibleAsset,
    }).addRemainingAccounts(
      [
        {
          signer: signer1PublicKey,
          isWritable: false,
        },
        {
          signer: signer2PublicKey,
          isWritable: false,
        },
        {
          signer: signer3PublicKey,
          isWritable: false,
        },
      ],
      0
    ).getInstructions();

    console.log('Step5');

    latestBlockhash = await umi.rpc.getLatestBlockhash();
    umiTransaction = umi.transactions.create({
      version: 0,
      payer: payer.publicKey,
      instructions: transferIx1,
      blockhash: latestBlockhash.blockhash,
    });

    transaction = toWeb3JsTransaction(umiTransaction);
    
    console.log('Step6');
    
    // Sign the Transaction with the signer's private key
    transaction.sign([payer, mintWallet, sourceWallet, signer1, signer2, signer3]);
    signedTransactionData = transaction.serialize();
    txnSignature = await connection.sendRawTransaction(
      Buffer.from(signedTransactionData, 'base64')
    );

    console.log(`Tranfer txnSignature: ${txnSignature}`);
    console.log('step7');
    console.log('-----------------------Transfer 1 ends--------------------'); 

    console.log('Waiting for some time...');
    await delay(20000);

    const signer1_multisig2 = Keypair.generate();
    console.log(`signer1_multisig2: ${signer1_multisig2.publicKey}`);
    const signer2_multisig2 = Keypair.generate(); 
    console.log(`signer2_multisig2: ${signer2_multisig2.publicKey}`);
    const signer3_multisig2 = Keypair.generate();
    console.log(`signer3_multisig2: ${signer3_multisig2.publicKey}`); 

    const multisigKey2 = await createMultisig(
      connection,
      payer,
      [
        signer1_multisig2.publicKey,
        signer2_multisig2.publicKey,
        signer3_multisig2.publicKey
      ],
      2
    );
    
    console.log(`Created 2/3 multisig2 ${multisigKey2.toBase58()}`);

    // create associated token address
    await createAssociatedTokenAddress(connection, payer, multisigKey2, mintWallet);
    
    const sourcePublicKey = new PublicKey(multisigKey1.toString());
    const sourceTokenAccount = await connection.getTokenAccountsByOwner(
      sourcePublicKey,
      {
        mint: mintWallet.publicKey,
      }
    );
    const sourceMultiSigAddress = sourceTokenAccount.value[0].pubkey;
    console.log(
      `sourceMultiSigAddress ${sourceMultiSigAddress}`
    );

    const destMultiSigAddress = await getAssociatedTokenAddress(
      mintWallet.publicKey,
      multisigKey2
    );
    console.log(`destMultiSigAddress: ${destMultiSigAddress}`);

    console.log('-----------------------Transfer 2 starts--------------------');
    const transferTx2 = new Transaction().add(
      createTransferInstruction(
        sourceMultiSigAddress, // source
        destMultiSigAddress, // dest
        multisigKey1,
        5000,
        [
          signer_mult1.publicKey,
          signer_mult2.publicKey,
          signer_mult3.publicKey,
        ],
        TOKEN_PROGRAM_ID
      )
    );

    blockHash = (await connection.getLatestBlockhash('finalized')).blockhash;
    transferTx2.feePayer = payer.publicKey;
    transferTx2.recentBlockhash = blockHash;

    transferTx2.sign(signer_mult1);
    transferTx2.partialSign(payer);
    transferTx2.partialSign(signer_mult2);
    transferTx2.partialSign(signer_mult3);
    
    signedTransactionData = transferTx2.serialize();
    txnSignature = await connection.sendRawTransaction(
      Buffer.from(signedTransactionData, 'base64')
    );

    console.log(`Tranfer txnSignature: ${txnSignature}`);
    console.log('step8');
    console.log('-----------------------Transfer 2 ends--------------------');
}

function delay(time) {
  return new Promise(resolve => setTimeout(resolve, time));
} 

async function createAssociatedTokenAddress(connection, payer, multisigKey, mintWallet) {
  console.log('-----------------------Associated token address creation starts--------------------');
  const associatedTokenAddress = await getAssociatedTokenAddress(
    mintWallet.publicKey,
    multisigKey
  );
  console.log(`associatedTokenAddress: ${associatedTokenAddress}`);
  
  const createtransaction = new Transaction().add(
    createAssociatedTokenAccountInstruction(
      payer.publicKey, // Payer of the transaction
      associatedTokenAddress, // Associated token account address
      multisigKey, // Owner of the new account
      mintWallet.publicKey // Mint address of the token
    )
  );
  const blockHash = (await connection.getLatestBlockhash('finalized')).blockhash;
  createtransaction.feePayer = payer.publicKey;
  createtransaction.recentBlockhash = blockHash;

  createtransaction.sign(payer);
  const signedTransactionData = createtransaction.serialize();
  const txnSignature = await connection.sendRawTransaction(
    Buffer.from(signedTransactionData, 'base64')
  );

  console.log(`createtransaction txnSignature: ${txnSignature}`);
  console.log(`Associated token address generated for multisigKey ${multisigKey.toBase58()}`);
  console.log('-----------------------Associated token address creation ends--------------------'); 
}

main()
  .then(() => {
    console.log("Finished successfully")
    process.exit(0)
  })
  .catch(error => {
    console.log(error)
    process.exit(1)
  });
