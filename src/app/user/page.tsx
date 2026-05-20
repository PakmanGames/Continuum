import { revalidatePath } from "next/cache";
import { desc, eq } from "drizzle-orm";
import { db } from "~/server/db";
import { users } from "~/server/db/schema";
import { PageTransition } from "../_components/page-transition";
import { UsersClient } from "./_components/users-client";

// Render on each request instead of prerendering at build time: this page reads
// live user data and mutates it via server actions, so a build-time static
// snapshot would be stale and would make the build depend on DB reachability.
export const dynamic = "force-dynamic";

async function createUser(formData: FormData) {
  "use server";

  const name = (formData.get("name") ?? "").toString().trim();
  const email = (formData.get("email") ?? "").toString().trim();
  const phoneNumber = (formData.get("phoneNumber") ?? "")
    .toString()
    .trim();

  if (!name || !email || !phoneNumber) {
    return;
  }

  await db.insert(users).values({
    name,
    email,
    phoneNumber,
  });

  revalidatePath("/user");
}

async function deleteUser(userId: number) {
  "use server";

  await db.delete(users).where(eq(users.id, userId));
  revalidatePath("/user");
}

export default async function UsersPage() {
  const existingUsers = await db
    .select()
    .from(users)
    .orderBy(desc(users.createdAt));

  return (
    <PageTransition>
      <UsersClient
        users={existingUsers}
        createUserAction={createUser}
        deleteUserAction={deleteUser}
      />
    </PageTransition>
  );
}
