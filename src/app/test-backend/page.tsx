import { db } from "~/server/db";

export default async function HomePage() {
  const posts = await db.query.posts.findMany();
  console.log(posts);

  const containers = await db.query.containers.findMany();
  console.log(containers);

  const statuses = await db.query.statuses.findMany();
  console.log(statuses);

  const errors = await db.query.errors.findMany();
  console.log(errors);

  return (
    <main>
      <div>Whats up</div>
      <h1>The posts tests</h1>
      <div>
        {posts.map((post) => (
          <div key={post.id}>
            {post.id} - {post.name}
          </div>
        ))}
      </div>
      <h1>The containers tests</h1>
      <div>
        {containers.map((container) => (
          <div key={container.id}>
            {container.id} - {container.name}
          </div>
        ))}
      </div>
      <h1>The statuses tests</h1>
      <div>
        {statuses.map((status) => (
          <div key={status.id}>
            {status.id} - {status.status} - {status.checkedInAt.toString()}
          </div>
        ))}
      </div>
      <h1>The errors tests</h1>
      <div>
        {errors.map((error) => (
          <div key={error.id}>
            {error.id} - {error.errorMessage} - {error.explaination} -{" "}
            {error.suggestedFix} - {error.occurredAt.toString()}
          </div>
        ))}
      </div>
    </main>
  );
}
