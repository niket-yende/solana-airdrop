const dotenv = require("dotenv");
const { mplTokenMetadata, createFungibleAsset, mintV1, TokenStandard, createAndMint, transferV1 } = require("@metaplex-foundation/mpl-token-metadata");
const { Connection, clusterApiUrl, Keypair } = require("@solana/web3.js");
const { createNoopSigner, signerIdentity, percentAmount } = require('@metaplex-foundation/umi');
const { createUmi } = require('@metaplex-foundation/umi-bundle-defaults');
const { toWeb3JsTransaction } = require("@metaplex-foundation/umi-web3js-adapters");
const { nftStorageUploader } = require("@metaplex-foundation/umi-uploader-nft-storage");
const fs = require("fs");
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
    console.log(`Assigning sourceWAllet as signerIdentity`);
    umi.use(signerIdentity(createNoopSigner(sourceWallet.publicKey), false));
    umi.payer = createNoopSigner(payer.publicKey);

    console.log('Step1');

    const uri = await uploadMetadata(umi, sftData);

    const builderIx = createAndMint(umi, 
        {
            mint: mint,
            name: sftData.name,
            uri: uri,
            amount: 20000000,
            sellerFeeBasisPoints: percentAmount(sftData.sellerFeeBasisPoints, 2),
            symbol: sftData.symbol,
            tokenStandard: TokenStandard.FungibleAsset,
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
      amount: 20000,
      tokenStandard: TokenStandard.FungibleAsset,
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
}

function delay(time) {
  return new Promise(resolve => setTimeout(resolve, time));
} 

async function uploadMetadata(umi, sftData) {
  // file to buffer
  const fileBuffer = fs.readFileSync("data/" + sftData.imageFile);

  const [imageUri] = await umi.uploader.upload([fileBuffer]);
  console.log(`image uri: ${imageUri}`);

  const uri = await umi.uploader.uploadJson({
    name: sftData.name,
    description: sftData.description,
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
