const { publicKey } = require('@metaplex-foundation/umi');
const { createUmi } = require('@metaplex-foundation/umi-bundle-defaults');
const { dasApi } = require('@metaplex-foundation/digital-asset-standard-api');

const umi = createUmi('https://api.devnet.solana.com').use(dasApi());
const assetId = publicKey('GcVtbMeMJtcG6xd3DxuFnvS6degkGUHLLJdKhHyfqfxH');

async function main() {
    const asset = await umi.rpc.getAsset(assetId);
    console.log(asset);

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