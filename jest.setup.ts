import { execSync } from 'child_process';

export default () => {
  console.log('Running Prisma migrations...');
  execSync('npx prisma migrate dev --name test-init', { stdio: 'inherit' });

  console.log('Seeding test database...');
  execSync('npm run seed', { stdio: 'inherit' });
};
