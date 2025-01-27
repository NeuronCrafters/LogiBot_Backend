import { MongoClient, ObjectId } from "mongodb";
import { hash } from "bcryptjs";

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.DB_NAME;

if (!MONGO_URI) {
  throw new Error("MONGO_URI não está definido. Verifique as variáveis de ambiente.");
}

const initializeDatabase = async () => {
  try {
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    console.log("Conectado ao MongoDB");

    const db = client.db(DB_NAME);
    const adminDb = client.db("admin");

    const dbUsers = [
      { user: "ramon", pwd: "password123", roles: [{ role: "readWrite", db: DB_NAME }] },
      { user: "Igor", pwd: "password123", roles: [{ role: "readWrite", db: DB_NAME }] },
      { user: "Alex", pwd: "password123", roles: [{ role: "readWrite", db: DB_NAME }] },
      { user: "Wesley", pwd: "password123", roles: [{ role: "readWrite", db: DB_NAME }] },
    ];

    for (const user of dbUsers) {
      try {
        await adminDb.command({
          createUser: user.user,
          pwd: user.pwd,
          roles: user.roles,
        });
        console.log(`Usuário ${user.user} criado com sucesso`);
      } catch (e) {
        console.log(`Usuário ${user.user} já existe ou ocorreu um erro:`, e.message);
      }
    }

    const usersCollection = db.collection("users");

    const hashedPassword = await hash("admin123", 10);
    const users = [
      {
        _id: new ObjectId("677e9e92a0735cfd26a96c0a"),
        name: "admin",
        email: "admin.com",
        password: hashedPassword,
        role: ["admin"],
        createdAt: new Date("2025-01-08T15:49:38.199Z"),
        updatedAt: new Date("2025-01-08T15:49:38.199Z"),
      },
    ];

    const existingUsers = await usersCollection.findOne({ email: "admin.com" });
    if (!existingUsers) {
      await usersCollection.insertMany(users);
      console.log("Usuários iniciais inseridos com sucesso");
    } else {
      console.log("Usuário admin já existe na coleção");
    }

    await client.close();
    console.log("Conexão fechada");
  } catch (error) {
    console.error("Erro ao inicializar o banco de dados:", error.message);
  }
};

initializeDatabase();
