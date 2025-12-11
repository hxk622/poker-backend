// DAO基础接口
export interface BaseDAO<T, K> {
  // 创建实体
  create(entity: Omit<T, 'id' | 'created_at' | 'updated_at'>): Promise<T>;
  
  // 根据ID获取实体
  getById(id: K): Promise<T | null>;
  
  // 更新实体
  update(id: K, entity: Partial<T>): Promise<T | null>;
  
  // 删除实体
  delete(id: K): Promise<boolean>;
  
  // 获取所有实体
  getAll(): Promise<T[]>;
}
