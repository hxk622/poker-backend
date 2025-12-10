import { User, RegisterUserInput, LoginUserInput } from '../types';
export declare const registerUser: (input: RegisterUserInput) => Promise<User>;
export declare const loginUser: (input: LoginUserInput) => Promise<{
    user: User;
    token: string;
}>;
export declare const getUserById: (userId: string) => Promise<User | null>;
export declare const updateUserProfile: (userId: string, data: Partial<User>) => Promise<User>;
export declare const getUserStats: (userId: string) => Promise<any>;
