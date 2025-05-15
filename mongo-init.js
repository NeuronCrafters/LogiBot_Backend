db = db.getSiblingDB('chatsael');

db.users.updateOne(
    { email: 'admin.org' },
    {
        $setOnInsert: {
            email: 'admin.org',
            password: 'password123',
            role: 'admin',
            createdAt: new Date()
        }
    },
    { upsert: true }
);
