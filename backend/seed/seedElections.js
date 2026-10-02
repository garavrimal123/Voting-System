// Seeds a "Mayor" election with 6 candidates (one per major national party)
// for a representative set of municipalities. Elections are created in
// 'draft' status — nothing is open to voters until an admin opens it from
// the admin panel.
//
// This does NOT cover all 753 local levels nationwide — that's a huge
// amount of location + candidate data to hand-author accurately. Use the
// admin panel's "Create Election" form (with the same dropdowns) to add
// more municipalities as needed; this script just gives you a running
// start with real, well-known parties.
//
// Run with: npm run seed:elections

require('dotenv').config();
const connectDB = require('../config/db');
const Election = require('../models/Election');
const Candidate = require('../models/Candidate');

// 6 major national parties currently active in Nepal (as of this project's
// knowledge cutoff). Candidate names are left as placeholders — real
// candidate nominations for local elections are finalized close to the
// election date, so replace these via the admin panel once known.
const PARTIES = [
  'Nepali Congress',
  'CPN-UML',
  'CPN (Maoist Centre)',
  'CPN (Unified Socialist)',
  'Rastriya Swatantra Party',
  'Rastriya Prajatantra Party',
];

const MUNICIPALITIES = [
  { province: 'Bagmati', district: 'Kathmandu', municipality: 'Kathmandu Metropolitan City' },
  { province: 'Bagmati', district: 'Lalitpur', municipality: 'Lalitpur Metropolitan City' },
  { province: 'Bagmati', district: 'Bhaktapur', municipality: 'Bhaktapur' },
  { province: 'Gandaki', district: 'Kaski', municipality: 'Pokhara Metropolitan City' },
  { province: 'Bagmati', district: 'Chitwan', municipality: 'Bharatpur Metropolitan City' },
  { province: 'Koshi', district: 'Morang', municipality: 'Biratnagar Metropolitan City' },
  { province: 'Koshi', district: 'Sunsari', municipality: 'Itahari Sub-Metropolitan City' },
  { province: 'Koshi', district: 'Sunsari', municipality: 'Dharan Sub-Metropolitan City' },
];

(async () => {
  await connectDB();

  for (const loc of MUNICIPALITIES) {
    const title = `Mayor - ${loc.municipality}`;
    const existing = await Election.findOne({ title, municipality: loc.municipality });
    if (existing) {
      console.log(`Skipping (already exists): ${title}`);
      continue;
    }

    const election = await Election.create({
      title,
      level: 'mayor',
      province: loc.province,
      district: loc.district,
      municipality: loc.municipality,
      status: 'draft',
    });

    for (const party of PARTIES) {
      await Candidate.create({
        election: election._id,
        name: `${party} Candidate`,
        party,
      });
    }

    console.log(`Created: ${title} (6 candidates, status: draft)`);
  }

  console.log('\nDone. Open any election from the admin panel when ready.');
  process.exit(0);
})();
