import { execSync } from "child_process";

export default () => {
  console.log("Running Prisma migrations...");
  execSync("pnpx prisma migrate dev --name test-init", { stdio: "inherit" });

  console.log("Seeding test database...");
  execSync("pnpm run seed", { stdio: "inherit" });
};
