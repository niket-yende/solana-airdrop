const dotenv = require("dotenv");
const { mplTokenMetadata, TokenStandard, createAndMint, fetchAllDigitalAssetWithTokenByOwner } = require("@metaplex-foundation/mpl-token-metadata");
const { Connection, clusterApiUrl, Keypair } = require("@solana/web3.js");
const { createNoopSigner, signerIdentity, percentAmount } = require('@metaplex-foundation/umi');
const { createUmi } = require('@metaplex-foundation/umi-bundle-defaults');
const { toWeb3JsTransaction } = require("@metaplex-foundation/umi-web3js-adapters");
const { nftStorageUploader } = require("@metaplex-foundation/umi-uploader-nft-storage");

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

    console.log('Waiting for some time...');
    await delay(30000);

    console.log('Check if the owner is credited with the SFT');
    const owner = sourceWallet.publicKey;
    const assets = await fetchAllDigitalAssetWithTokenByOwner(umi, owner);
    const foundAsset = assets.find(
      asset => asset.publicKey.toString() === mintAddress
    );
    console.log('foundAsset');
    console.log(foundAsset);
}

function delay(time) {
  return new Promise(resolve => setTimeout(resolve, time));
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
