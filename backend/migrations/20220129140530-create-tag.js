"use strict";
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("Tags", {
      name: {
        type: Sequelize.STRING,
        allowNull: false,
        primaryKey: true,
      },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable("Tags");
  },
};
