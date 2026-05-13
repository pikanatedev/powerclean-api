import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { UsersService } from './users/users.service';
import { Role } from './common/enums/role.enum';

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const usersService = app.get(UsersService);

  const seedUsers = [
    {
      username: 'admin',
      password: 'admin1234',
      fullName: 'System Admin',
      role: Role.ADMIN,
    },
    {
      username: 'staff',
      password: 'staff1234',
      fullName: 'Staff User',
      role: Role.STAFF,
    },
  ];

  for (const u of seedUsers) {
    const existed = await usersService.findByUsername(u.username);
    if (existed) {
      console.log(`- ${u.username} already exists, skipped.`);
      continue;
    }
    await usersService.create(u);
    console.log(`+ created ${u.role}: ${u.username} / ${u.password}`);
  }

  await app.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
