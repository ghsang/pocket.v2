import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { users } from './schema';

const DATABASE_URL =
	process.env.DATABASE_URL || 'postgres://root:mysecretpassword@localhost:5432/local';

async function seed() {
	console.log('Connecting to database...');
	const client = postgres(DATABASE_URL);
	const db = drizzle(client);

	console.log('Seeding users...');

	// Create the two users
	await db
		.insert(users)
		.values([
			{
				kakaoId: 'user-hyuksang',
				username: '권혁상',
				email: 'hyuksang@example.com',
				role: 'admin',
				isApproved: true
			},
			{
				kakaoId: 'user-hyunkyung',
				username: '이현경',
				email: 'hyunkyung@example.com',
				role: 'user',
				isApproved: true
			}
		])
		.onConflictDoNothing();

	console.log('Seeding complete!');
	await client.end();
}

seed()
	.then(() => process.exit(0))
	.catch((e) => {
		console.error('Seed error:', e);
		process.exit(1);
	});
