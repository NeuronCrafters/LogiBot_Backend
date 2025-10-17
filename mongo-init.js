use('logibot_db');

db.users.updateOne(
  { _id: ObjectId("677e9e92a0735cfd26a96c0a") },
  {
    $set: {
      "name": "admin",
      "email": "ch47b07sa3l@gmail.com",
      "password": "$2a$10$Fn3Y7Pxd7Yb3TMTsS2QYjOx9sOwUWIQfrMsVMr5xALfQ1K9fNnAXy",
      "role": ["admin"],
      "status": "active",
      "updatedAt": ISODate(),
    },
    $setOnInsert: {
      "createdAt": ISODate(),
      "__v": 0
    }
  },
  { upsert: true }
);