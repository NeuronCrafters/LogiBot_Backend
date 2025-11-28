import { connectDB } from '../database';
import { User } from '../../models/User';
import bcrypt from 'bcryptjs';

const ADMIN_USER_DATA = {
  _id: '677e9e92a0735cfd26a96c0a',
  name: 'admin',
  email: 'ch47b07sa3l@gmail.com',
  password: '$2a$10$Fn3Y7Pxd7Yb3TMTsS2QYjOx9sOwUWIQfrMsVMr5xALfQ1K9fNnAXy',
  role: ['admin'],
  status: 'active'
};

export async function initAdminUser(): Promise<void> {
  await connectDB();

  const adminId = ADMIN_USER_DATA._id;

  try {
    const existingUser = await User.findById(adminId);

    if (existingUser) {
      await User.findByIdAndUpdate(adminId, {
        $set: {
          name: ADMIN_USER_DATA.name,
          email: ADMIN_USER_DATA.email,
          password: ADMIN_USER_DATA.password,
          role: ADMIN_USER_DATA.role,
          status: ADMIN_USER_DATA.status,
        }
      });
      console.log(' usuário admin existente atualizado com sucesso.');
    } else {
      await User.create(ADMIN_USER_DATA);
      console.log(' usuário admin criado com sucesso.');
    }

  } catch (error) {
    console.error(' erro ao inicializar o usuário admin:', error);
  }
}