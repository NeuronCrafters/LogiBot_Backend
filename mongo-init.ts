import { MongoClient, ObjectId } from "mongodb";
import { hash } from "bcryptjs";

const MONGO_URI = process.env.MONGO_URI || "mongodb://root:example@localhost:27017";
const DB_NAME = process.env.DB_NAME || "ChatSAEL";

const initializeDatabase = async () => {
  try {
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    console.log("Conectado ao MongoDB");

    const db = client.db(DB_NAME);

    const hashedPassword = await hash("password123", 10);

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

    const professors = [
      {
        _id: new ObjectId(),
        name: "Vitor",
        email: "vitor@Unifesspa.edu.br",
        password: hashedPassword,
        role: ["professor", "course-coordinator"],
        school: "Unifesspa",
        students: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        _id: new ObjectId(),
        name: "Leia",
        email: "leia@unifesspa.edu.br",
        password: hashedPassword,
        role: ["professor"],
        school: "Unifesspa",
        students: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        _id: new ObjectId(),
        name: "Alex",
        email: "alex@Unifesspa.edu.br",
        password: hashedPassword,
        role: ["professor"],
        school: "Unifesspa",
        students: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const professorsCollection = db.collection("Professor");
    for (const professor of professors) {
      const existingProfessor = await professorsCollection.findOne({ email: professor.email });
      if (!existingProfessor) {
        await professorsCollection.insertOne(professor);
        console.log(`Professor ${professor.name} criado com sucesso`);
      } else {
        console.log(`Professor ${professor.name} já existe`);
      }
    }

    const usersCollection = db.collection("User");
    for (const user of users) {
      const existingUser = await usersCollection.findOne({ email: user.email });
      if (!existingUser) {
        await usersCollection.insertOne(user);
        console.log(`Usuário ${user.name} criado com sucesso`);
      } else {
        console.log(`Usuário ${user.name} já existe`);
      }
    }

    await client.close();
    console.log("Conexão com o MongoDB encerrada");
  } catch (error) {
    console.error("Erro ao inicializar o banco de dados:", error.message);
  }
};

initializeDatabase();
