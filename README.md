# Texas Hold'em Poker Backend Service

This is a Texas Hold'em poker game backend service developed with Node.js and TypeScript, using Express for HTTP APIs and Socket.IO for real-time communication.

## Technology Stack

- **Language**: TypeScript
- **Framework**: Express.js
- **Real-time Communication**: Socket.IO
- **Database**: PostgreSQL
- **Caching**: Redis
- **AI Integration**: Custom AI algorithms
- **Authentication**: JWT (JSON Web Tokens)
- **Development Tools**: ts-node-dev

## Features

- ✅ HTTP API Services
- ✅ WebSocket Real-time Communication
- ✅ Health Check Endpoints
- ✅ Environment Variable Configuration
- ✅ CORS Support
- ✅ TypeScript Type Safety
- ✅ Complete Texas Hold'em Game Logic
- ✅ AI-powered Hand Analysis
- ✅ Pot Splitting System
- ✅ Comprehensive Logging
- ✅ Database and Redis Integration

## Quick Start

### Prerequisites

- Node.js >= 16.0.0
- npm >= 8.0.0
- PostgreSQL (for persistent storage)
- Redis (for caching)

### Installation

```bash
npm install
```

### Environment Configuration

Copy and modify the `.env` file:

```bash
cp .env.example .env
```

Configure the following parameters in the `.env` file:

```env
# Server Port
PORT=3000

# PostgreSQL Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password_here
DB_NAME=texas_holdem

# Redis Cache
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT Configuration
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=7d
```

### Running the Application

#### Development Mode

```bash
npm run dev
```

The development server will start at `http://localhost:3000` with hot reload support.

#### Production Mode

```bash
# First compile TypeScript
npm run build

# Then start the production server
npm run start
```

## Project Structure

```
├── src/
│   ├── index.ts                  # Main entry file
│   ├── routes/                   # API route definitions
│   ├── services/                 # Business logic services
│   │   ├── aiService.ts          # AI analysis services
│   │   ├── gameService.ts        # Core game logic
│   │   ├── loggerService.ts      # Logging system
│   │   └── websocketService.ts   # Real-time communication
│   └── types/                    # TypeScript type definitions
├── logs/                         # Application log files
├── package.json                  # Project dependencies
├── tsconfig.json                 # TypeScript configuration
└── README.md                     # Project documentation
```

## API Documentation

### HTTP API

#### Health Check

```
GET /ping
```

Response Example:

```json
{
  "message": "Poker backend service is running!",
  "timestamp": "2025-12-09T08:50:46.169Z"
}
```

#### Game APIs

- `POST /api/games/start` - Start a new game session
- `POST /api/games/action` - Execute a game action (fold, call, raise)
- `GET /api/games/status/:id` - Get current game status
- `GET /api/games/history` - Get game history

### WebSocket Events

#### Connection

```
Event: connection
```

Triggered when a client successfully connects.

#### Game Events

```
Event: game:start
Event: game:action
Event: game:status
Event: game:end
```

## Development Guidelines

### Code Standards

- Write all code in TypeScript
- Follow consistent naming conventions
- Use async/await for asynchronous operations
- Add appropriate error handling
- Write meaningful comments

### Development Workflow

1. Clone the repository
2. Install dependencies
3. Configure environment variables
4. Start the development server
5. Implement features or fix bugs
6. Test thoroughly
7. Commit changes

## Production Deployment

1. Ensure all dependencies are installed
2. Configure production environment variables
3. Compile TypeScript code
4. Start the production server
5. Set up a reverse proxy (e.g., Nginx)
6. Configure SSL/TLS for secure connections
7. Set up monitoring and logging

## License

MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Contact

For questions or suggestions, please contact the project maintainers.