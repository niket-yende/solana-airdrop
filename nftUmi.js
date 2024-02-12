const dotenv = require("dotenv");
const { generateSigner, signerIdentity, createSignerFromKeypair }  = require("@metaplex-foundation/umi");
const { createNft, mplTokenMetadata, fetchDigitalAsset } = require("@metaplex-foundation/mpl-token-metadata");
const { createUmi } = require('@metaplex-foundation/umi-bundle-defaults');
dotenv.config();

/**
 * Function to create NFT.
 * Reference: https://developers.metaplex.com/token-metadata/getting-started/js
 * https://www.quicknode.com/guides/solana-development/spl-tokens/how-to-create-a-fungible-spl-token-with-the-new-metaplex-token-standard
 * 
 */
async function main() {
    // Use the RPC endpoint of your choice.
    const umi = createUmi('https://api.testnet.solana.com')
    // .use(nftStorageUploader({token: nftStorageToken}))
    .use(mplTokenMetadata());

    const secret = JSON.parse(process.env.PRIVATE_KEY ?? "");
    const userWallet = umi.eddsa.createKeypairFromSecretKey(new Uint8Array(secret));
    const userWalletSigner = createSignerFromKeypair(umi, userWallet);
    
    umi.use(signerIdentity(userWalletSigner));

    console.log('Step1');

    const mint = generateSigner(umi);
    const nft = await createNft(umi, 
        {
            mint: mint,
            name: 'My NFT',
            uri: 'https://nftstorage.link/ipfs/bafkreigzlgcwuehyzg3okdinnbhyduurhfnuulqdimhihreihckvalv7a4',
            sellerFeeBasisPoints: 0,
        }
    ).sendAndConfirm(umi);

    console.log('step2');
    
    const asset = await fetchDigitalAsset(umi, mint.publicKey);
    console.log(`asset: ${asset?.metadata?.name}`);
}

main()
  .then(() => {
    console.log("Finished successfully")
    process.exit(0)
  })
  .catch(error => {
    console.log(error)
    process.exit(1)
  })
