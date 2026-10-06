require("dotenv").config();
const app = require("./app");
const { sequelize } = require("./models");
const env = process.env.NODE_ENV || "development";
const PORT = process.env.PORT || 3001;

(async () => {
  try {
    await sequelize.sync({ alter: true });
    console.log(`Connection with ${env} database has been established.`);
    app.listen(PORT, () =>
      console.log(`Server running on http://localhost:${PORT}`),
    );
  } catch (error) {
    console.error("Unable to start the server:", error);
    await sequelize.close();
    process.exitCode = 1;
  }
})();
