import swaggerJsdoc from 'swagger-jsdoc';

// Swagger配置选项
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: '德州扑克游戏API',
      version: '1.0.0',
      description: '德州扑克游戏后端API文档',
      contact: {
        name: '项目团队',
        email: 'contact@example.com',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000/api',
        description: '本地开发服务器',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  // 指定API文档的源文件路径
  apis: ['./src/routes/*.ts', './src/types/index.ts'],
};

// 生成Swagger规范
const swaggerSpec = swaggerJsdoc(swaggerOptions);

export default swaggerSpec;
