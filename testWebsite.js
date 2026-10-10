
const { researchWebsite } = require('./websiteResearch');

async function main() {
  console.log('Connecting to a real website...\n');

  const result = await researchWebsite(
    'https://www.salesforce.com'
  );

  console.log('Research result:');
  console.log(result);
}

main();
