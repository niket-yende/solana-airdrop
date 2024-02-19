const dotenv = require("dotenv");
const { createNft, mplTokenMetadata, transferV1, TokenStandard } = require("@metaplex-foundation/mpl-token-metadata");
const { Connection, clusterApiUrl, Keypair} = require("@solana/web3.js");
const { createNoopSigner, signerIdentity } = require('@metaplex-foundation/umi');
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

async function main() {
    // create a new connection to the cluster's API
    const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');

    // Use the RPC endpoint of your choice.
    const umi = createUmi('https://api.devnet.solana.com')
    .use(nftStorageUploader({token: process.env.NFT_STORAGE_TOKEN}))
    .use(mplTokenMetadata());

    const secret = JSON.parse(process.env.PRIVATE_KEY ?? "");
    const payer = Keypair.fromSecretKey(new Uint8Array(secret));
    umi.use(signerIdentity(createNoopSigner(payer.publicKey)));

    const toWallet = Keypair.generate();
    const toAddress = toWallet.publicKey.toString();
    console.log(toAddress); 
    const mint = createNoopSigner(toAddress);

    const destinationWallet = Keypair.generate(); 
    console.log(`destinationWallet: ${destinationWallet.publicKey}`); 

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

    const transferIx = transferV1(umi, {
      mint,
      tokenOwner: payer.publicKey,
      destinationOwner: destinationWallet.publicKey,
      tokenStandard: TokenStandard.NonFungible,
    }).getInstructions();

    console.log('Step2');

    const latestBlockhash = await umi.rpc.getLatestBlockhash();
    const umiTransaction = umi.transactions.create({
      version: 0,
      payer: payer.publicKey,
      instructions: [...builderIx, ...transferIx],
      blockhash: latestBlockhash.blockhash,
    });

    const transaction = toWeb3JsTransaction(umiTransaction);

    console.log('Step3');

    // Sign the Transaction with the signer's private key
    transaction.sign([payer, toWallet]);
    const signedTransactionData = transaction.serialize();
    const txnSignature = await connection.sendRawTransaction(
      Buffer.from(signedTransactionData, 'base64')
    );

    console.log(`txnSignature: ${txnSignature}`);
    
    console.log('step4');
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
