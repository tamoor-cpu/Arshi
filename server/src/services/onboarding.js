// Default new-hire onboarding checklist. When an employee account is created
// these steps are generated for that user; the new hire must complete the
// required ones before they can reach the app.
const DEFAULT_ONBOARDING = [
  { key: 'profile', category: 'profile', title: 'Confirm your profile', description: 'Verify your name, phone, and emergency contact.', required: true },
  { key: 'w4', category: 'paperwork', title: 'W-4 Tax Withholding', description: 'Complete your federal W-4 form.', required: true },
  { key: 'i9', category: 'paperwork', title: 'I-9 Employment Eligibility', description: 'Verify your eligibility to work.', required: true },
  { key: 'direct_deposit', category: 'paperwork', title: 'Direct Deposit Authorization', description: 'Set up direct deposit for payroll.', required: true },
  { key: 'handbook', category: 'policy', title: 'Employee Handbook Acknowledgement', description: 'Read and acknowledge the employee handbook.', required: true },
  { key: 'safety_policy', category: 'policy', title: 'Safety & Chemical Handling Policy', description: 'Acknowledge the site safety and chemical handling policy.', required: true },
  { key: 'training', category: 'training', title: 'New Employee Training', description: 'Complete all required training modules.', required: true },
];

async function generateOnboarding(tx, userId) {
  await tx.onboardingTask.createMany({
    data: DEFAULT_ONBOARDING.map((t, i) => ({
      userId,
      key: t.key,
      category: t.category,
      title: t.title,
      description: t.description,
      required: t.required,
      sortOrder: i,
    })),
  });
}

module.exports = { DEFAULT_ONBOARDING, generateOnboarding };
