const dotenv = require("dotenv");
const { createNft, mplTokenMetadata, createFungible, createFungibleAsset, transferV1, TokenStandard } = require("@metaplex-foundation/mpl-token-metadata");
const { Connection, clusterApiUrl, Keypair, VersionedTransaction} = require("@solana/web3.js");
const { createNoopSigner, signerIdentity, percentAmount, generateSigner } = require('@metaplex-foundation/umi');
const { createUmi } = require('@metaplex-foundation/umi-bundle-defaults');
const { toWeb3JsTransaction } = require("@metaplex-foundation/umi-web3js-adapters");
const { nftStorageUploader } = require("@metaplex-foundation/umi-uploader-nft-storage");
const fs = require("fs");
dotenv.config();

const nftData = {
  name: "I30NFT",
  symbol: "I30",
  description: "Hyundai i30 performance NFT",
  sellerFeeBasisPoints: 0,
  imageFile: "hyundai.jpg"
}

/**
 * Reference: https://solana.stackexchange.com/questions/5004/how-to-properly-serialize-and-deserialize-versioned-transaction
 * https://developers.metaplex.com/token-metadata/transfer
 * https://developers.metaplex.com/umi/public-keys-and-signers#signers
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
    // umi.use(signerIdentity(createNoopSigner(payer.publicKey)));

    console.log(`payer public key: ${payer.publicKey}`);

    const mintWallet = Keypair.generate();
    const mintAddress = mintWallet.publicKey.toString();
    console.log(`mintAddress: ${mintAddress}`); 
    const mint = createNoopSigner(mintAddress);
    
    const sourceWallet = Keypair.generate(); 
    console.log(`sourceWallet: ${sourceWallet.publicKey}`); 
    console.log(`Assigning sourceWAllet as signerIdentity`);
    umi.use(signerIdentity(createNoopSigner(sourceWallet.publicKey), false));
    umi.payer = createNoopSigner(payer.publicKey);

    console.log('Step1');

    const uri = await uploadMetadata(umi, nftData);

    const builderIx = createNft(umi, 
        {
            mint: mint,
            name: nftData.name,
            uri: uri,
            sellerFeeBasisPoints: nftData.sellerFeeBasisPoints,
            symbol: nftData.symbol,
        }
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
    transaction.sign([payer, mintWallet, sourceWallet]);
    let signedTransactionData = transaction.serialize();
    let txnSignature = await connection.sendRawTransaction(
      Buffer.from(signedTransactionData, 'base64')
    );

    console.log(`txnSignature: ${txnSignature}`);
    
    console.log('step4');

    console.log('Waiting for some time...');
    await delay(60000);
    
    console.log('Transferring token to destination account');  
    const destinationWallet = Keypair.generate(); 
    console.log(`destinationWallet: ${destinationWallet.publicKey}`); 

    const transferIx = transferV1(umi, {
      mint,
      authority: createNoopSigner(sourceWallet.publicKey),
      tokenOwner: sourceWallet.publicKey,
      destinationOwner: destinationWallet.publicKey,
      tokenStandard: TokenStandard.NonFungible,
    }).getInstructions();

    console.log('Step5');

    latestBlockhash = await umi.rpc.getLatestBlockhash();
    umiTransaction = umi.transactions.create({
      version: 0,
      payer: payer.publicKey,
      instructions: transferIx,
      blockhash: latestBlockhash.blockhash,
    });

    transaction = toWeb3JsTransaction(umiTransaction);
    
    console.log('Step6');
    
    // Sign the Transaction with the signer's private key
    transaction.sign([payer, mintWallet, sourceWallet]);
    signedTransactionData = transaction.serialize();
    txnSignature = await connection.sendRawTransaction(
      Buffer.from(signedTransactionData, 'base64')
    );

    console.log(`Tranfer txnSignature: ${txnSignature}`);
    console.log('step7');

    console.log('Waiting for some time...');
    await delay(60000);

    console.log('Transferring token to new wallet account');  
    const newWallet = Keypair.generate(); 
    console.log(`newWallet: ${newWallet.publicKey}`); 

    const newTransferIx = transferV1(umi, {
      mint,
      authority: createNoopSigner(destinationWallet.publicKey),
      tokenOwner: destinationWallet.publicKey,
      destinationOwner: newWallet.publicKey,
      tokenStandard: TokenStandard.NonFungible,
    }).getInstructions();

    console.log('Step8');

    latestBlockhash = await umi.rpc.getLatestBlockhash();
    umiTransaction = umi.transactions.create({
      version: 0,
      payer: payer.publicKey,
      instructions: newTransferIx,
      blockhash: latestBlockhash.blockhash,
    });

    transaction = toWeb3JsTransaction(umiTransaction);
    
    console.log('Step9');
    
    // Sign the Transaction with the signer's private key
    transaction.sign([payer, mintWallet, destinationWallet]);
    signedTransactionData = transaction.serialize();
    txnSignature = await connection.sendRawTransaction(
      Buffer.from(signedTransactionData, 'base64')
    );

    console.log(`New Tranfer txnSignature: ${txnSignature}`);
    console.log('step10');
}

function delay(time) {
  return new Promise(resolve => setTimeout(resolve, time));
} 

async function uploadMetadata(umi, nftData) {
  // file to buffer
  const fileBuffer = fs.readFileSync("data/" + nftData.imageFile);

  const [imageUri] = await umi.uploader.upload([fileBuffer]);
  console.log(`image uri: ${imageUri}`);

  const uri = await umi.uploader.uploadJson({
    name: nftData.name,
    description: nftData.description,
    image: imageUri,
  });

  console.log(`metadata uri: ${uri}`);
  return uri;
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
