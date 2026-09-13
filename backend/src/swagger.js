const swaggerJsdoc = require("swagger-jsdoc");
const path = require("path");

// Génère la documentation OpenAPI à partir des commentaires JSDoc (@openapi)
// présents directement au-dessus de chaque route, dans src/routes/*.js.
// Documentation officielle : https://github.com/Surnet/swagger-jsdoc
const options = {
  definition: {
    openapi: "3.0.3",
    info: {
      title: "API - Projet collaboratif type Google Docs",
      version: "1.0.0",
      description: "Documentation générée automatiquement depuis les commentaires JSDoc des routes.",
    },
    servers: [{ url: "/api" }],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: [path.join(__dirname, "routes", "*.js")],
};

module.exports = swaggerJsdoc(options);
