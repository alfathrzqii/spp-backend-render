import morgan from "morgan";
import { logger } from "../../services/WinstonLogger.js";

const stream = {
  write: (message: string) => logger.info(message.trim()),
};

const httpLogger = morgan(
  ":method :url :status :response-time ms - :res[content-length]",
  { stream }
);

export default httpLogger;
