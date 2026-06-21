const { body, param, query, validationResult } = require('express-validator');

// Middleware to check validation results
const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
};

// ============================================================
// EQUIPMENT VALIDATORS
// ============================================================
const validateEquipment = [
  body('name').trim().notEmpty().withMessage('Equipment name is required'),
  body('category')
    .isIn(['tunnel', 'dryer', 'pump', 'vacuum', 'chemical_system', 'conveyor', 'other'])
    .withMessage('Invalid equipment category'),
  body('serialNumber').optional().trim(),
  body('manufacturer').optional().trim(),
  body('model').optional().trim(),
  body('status')
    .optional()
    .isIn(['operational', 'needs_maintenance', 'out_of_service', 'retired'])
    .withMessage('Invalid equipment status'),
  handleValidation,
];

const validateEquipmentUpdate = [
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
  body('category')
    .optional()
    .isIn(['tunnel', 'dryer', 'pump', 'vacuum', 'chemical_system', 'conveyor', 'other'])
    .withMessage('Invalid equipment category'),
  body('status')
    .optional()
    .isIn(['operational', 'needs_maintenance', 'out_of_service', 'retired'])
    .withMessage('Invalid equipment status'),
  handleValidation,
];

const validateMaintenance = [
  body('type')
    .isIn(['preventive', 'repair', 'inspection', 'emergency'])
    .withMessage('Invalid maintenance type'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('cost').optional().isFloat({ min: 0 }).withMessage('Cost must be a positive number'),
  handleValidation,
];

// ============================================================
// INVENTORY VALIDATORS
// ============================================================
const validateInventoryItem = [
  body('name').trim().notEmpty().withMessage('Item name is required'),
  body('category')
    .isIn(['chemical', 'supply', 'part', 'cleaning'])
    .withMessage('Invalid inventory category'),
  body('unit')
    .optional()
    .isIn(['gallons', 'liters', 'cases', 'each', 'lbs'])
    .withMessage('Invalid unit'),
  body('currentStock')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Current stock must be non-negative'),
  body('minStock')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Minimum stock must be non-negative'),
  body('costPerUnit')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Cost per unit must be non-negative'),
  handleValidation,
];

const validateUsageLog = [
  body('quantity')
    .isFloat()
    .withMessage('Quantity is required and must be a number'),
  body('type')
    .isIn(['usage', 'restock', 'adjustment', 'waste'])
    .withMessage('Invalid usage type'),
  body('notes').optional().trim(),
  handleValidation,
];

// ============================================================
// CUSTOMER VALIDATORS
// ============================================================
const validateCustomer = [
  body('firstName').trim().notEmpty().withMessage('First name is required'),
  body('lastName').trim().notEmpty().withMessage('Last name is required'),
  body('email').optional({ values: 'falsy' }).isEmail().withMessage('Invalid email address'),
  body('phone').optional().trim(),
  body('membershipType')
    .optional()
    .isIn(['none', 'basic', 'premium', 'unlimited'])
    .withMessage('Invalid membership type'),
  handleValidation,
];

const validateVehicle = [
  body('make').trim().notEmpty().withMessage('Vehicle make is required'),
  body('model').trim().notEmpty().withMessage('Vehicle model is required'),
  body('year').optional().trim(),
  body('color').optional().trim(),
  body('licensePlate').optional().trim(),
  handleValidation,
];

const validateVisit = [
  body('washType')
    .optional()
    .isIn(['basic', 'premium', 'ultimate', 'detail'])
    .withMessage('Invalid wash type'),
  body('amount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Amount must be non-negative'),
  handleValidation,
];

// ============================================================
// CLAIMS VALIDATORS
// ============================================================
const validateClaim = [
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('damageType')
    .optional()
    .isIn(['scratch', 'dent', 'mirror', 'antenna', 'paint', 'other'])
    .withMessage('Invalid damage type'),
  body('vehicleMake').optional().trim(),
  body('vehicleModel').optional().trim(),
  body('estimatedCost')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Estimated cost must be non-negative'),
  handleValidation,
];

const validateClaimUpdate = [
  body('status')
    .optional()
    .isIn(['reported', 'investigating', 'approved', 'denied', 'resolved'])
    .withMessage('Invalid claim status'),
  body('resolution').optional().trim(),
  body('estimatedCost')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Estimated cost must be non-negative'),
  handleValidation,
];

// ============================================================
// TRAINING VALIDATORS
// ============================================================
const validateTrainingModule = [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('category')
    .isIn(['safety', 'equipment', 'chemical', 'customer_service', 'operations'])
    .withMessage('Invalid training category'),
  body('durationMinutes')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Duration must be a positive integer'),
  body('isRequired').optional().isBoolean().withMessage('isRequired must be boolean'),
  body('sequence').optional().isInt({ min: 0 }).withMessage('Sequence must be non-negative'),
  handleValidation,
];

// ============================================================
// TASK VALIDATORS
// ============================================================
const validateTask = [
  body('title').trim().notEmpty().withMessage('Task title is required'),
  body('priority')
    .optional()
    .isIn(['critical', 'high', 'medium', 'low'])
    .withMessage('Invalid priority level'),
  body('category')
    .isIn(['maintenance', 'cleaning', 'chemical', 'staffing', 'customer', 'other'])
    .withMessage('Invalid task category'),
  body('status')
    .optional()
    .isIn(['pending', 'assigned', 'in_progress', 'completed', 'cancelled'])
    .withMessage('Invalid task status'),
  handleValidation,
];

const validateTaskUpdate = [
  body('title').optional().trim().notEmpty().withMessage('Title cannot be empty'),
  body('priority')
    .optional()
    .isIn(['critical', 'high', 'medium', 'low'])
    .withMessage('Invalid priority level'),
  body('status')
    .optional()
    .isIn(['pending', 'assigned', 'in_progress', 'completed', 'cancelled'])
    .withMessage('Invalid task status'),
  handleValidation,
];

// ============================================================
// SUPPLIER VALIDATORS
// ============================================================
const validateSupplier = [
  body('name').trim().notEmpty().withMessage('Supplier name is required'),
  body('contactEmail').optional({ values: 'falsy' }).isEmail().withMessage('Invalid email address'),
  body('phone').optional().trim(),
  body('website').optional().trim(),
  handleValidation,
];

module.exports = {
  handleValidation,
  validateEquipment,
  validateEquipmentUpdate,
  validateMaintenance,
  validateInventoryItem,
  validateUsageLog,
  validateCustomer,
  validateVehicle,
  validateVisit,
  validateClaim,
  validateClaimUpdate,
  validateTrainingModule,
  validateTask,
  validateTaskUpdate,
  validateSupplier,
};
