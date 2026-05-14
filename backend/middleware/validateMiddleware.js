const { ZodError } = require('zod');

const validate = (schemas) => (req, res, next) => {
  try {
    if (schemas.body) {
      req.body = schemas.body.parse(req.body);
    }
    if (schemas.query) {
      req.query = schemas.query.parse(req.query);
    }
    if (schemas.params) {
      req.params = schemas.params.parse(req.params);
    }
    next();
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        message: 'Erreur de validation',
        errors: error.flatten().fieldErrors,
      });
    }
    // Pour les autres erreurs
    next(error);
  }
};

module.exports = { validate };
