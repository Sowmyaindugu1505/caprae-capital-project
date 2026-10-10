
const { isPublicIP } = require('./websiteResearch');

const testAddresses = [
  '127.0.0.1',
  '192.168.1.1',
  '10.0.0.5',
  '23.202.229.145',
  '::1',
  'fe80::1',
  'fc00::1',
  '2600:140f:7200:49::17d4:68'
];

for (const address of testAddresses) {
  console.log(address, '=>', isPublicIP(address));
}
