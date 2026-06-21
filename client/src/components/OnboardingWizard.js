import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../services/api';
import {
  MapPin, Users, ClipboardCheck, CheckCircle2, ArrowRight, ArrowLeft,
  Droplets, Building2, UserPlus, Sparkles,
} from 'lucide-react';

const STEPS = [
  { id: 'welcome', title: 'Welcome to ARSHI', icon: Droplets },
  { id: 'location', title: 'Set Up Your Location', icon: MapPin },
  { id: 'team', title: 'Invite Your Team', icon: Users },
  { id: 'done', title: 'You\'re All Set!', icon: Sparkles },
];

export default function OnboardingWizard({ onComplete }) {
  const { loadUser } = useAuth();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [locationData, setLocationData] = useState({
    name: '', address: '', city: '', state: '', zipCode: '',
  });
  const [teamMembers, setTeamMembers] = useState([{ email: '', firstName: '', lastName: '', role: 'EMPLOYEE' }]);
  const [creating, setCreating] = useState(false);

  const addTeamMember = () => {
    setTeamMembers([...teamMembers, { email: '', firstName: '', lastName: '', role: 'EMPLOYEE' }]);
  };

  const updateTeamMember = (idx, field, value) => {
    const updated = [...teamMembers];
    updated[idx][field] = value;
    setTeamMembers(updated);
  };

  const removeTeamMember = (idx) => {
    setTeamMembers(teamMembers.filter((_, i) => i !== idx));
  };

  const createLocation = async () => {
    if (!locationData.name) {
      toast.error('Location name is required');
      return false;
    }
    setCreating(true);
    try {
      await api.post('/locations', locationData);
      await loadUser();
      toast.success('Location created successfully!');
      return true;
    } catch (err) {
      toast.error('Failed to create location');
      return false;
    } finally {
      setCreating(false);
    }
  };

  const inviteTeam = async () => {
    const validMembers = teamMembers.filter((m) => m.email && m.firstName);
    if (validMembers.length === 0) return true; // skip if none

    setCreating(true);
    let successCount = 0;
    for (const member of validMembers) {
      try {
        await api.post('/users/invite', member);
        successCount++;
      } catch (err) {
        // silently skip failures (e.g., duplicate email)
      }
    }
    setCreating(false);
    if (successCount > 0) {
      toast.success(`${successCount} team member${successCount > 1 ? 's' : ''} invited!`);
    }
    return true;
  };

  const handleNext = async () => {
    if (step === 1) {
      const ok = await createLocation();
      if (!ok) return;
    }
    if (step === 2) {
      await inviteTeam();
    }
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      localStorage.setItem('washops-onboarding-done', 'true');
      onComplete?.();
    }
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-wash-900 via-wash-800 to-blue-900">
      <div className="w-full max-w-xl mx-4">
        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                i < step ? 'bg-green-500 text-white' :
                i === step ? 'bg-blue-500 text-white' :
                'bg-white/20 text-white/50'
              }`}>
                {i < step ? <CheckCircle2 className="w-5 h-5" /> : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`w-12 h-0.5 ${i < step ? 'bg-green-400' : 'bg-white/20'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">
          {/* Step: Welcome */}
          {step === 0 && (
            <div className="p-8 text-center">
              <Droplets className="w-16 h-16 text-blue-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Welcome to ARSHI!</h2>
              <p className="text-gray-500 dark:text-gray-400 mb-6">
                Let's get your car wash operations set up in just a few quick steps.
              </p>
              <div className="grid grid-cols-3 gap-4 text-center">
                {[
                  { icon: Building2, label: 'Add Location' },
                  { icon: UserPlus, label: 'Invite Team' },
                  { icon: ClipboardCheck, label: 'Start Operating' },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700">
                    <Icon className="w-6 h-6 text-blue-500 mx-auto mb-1" />
                    <p className="text-xs text-gray-600 dark:text-gray-300 font-medium">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step: Location */}
          {step === 1 && (
            <div className="p-8">
              <div className="text-center mb-6">
                <MapPin className="w-10 h-10 text-blue-500 mx-auto mb-2" />
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Set Up Your Location</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Where is your car wash?</p>
              </div>
              <div className="space-y-3">
                <input
                  type="text" placeholder="Location name *"
                  value={locationData.name}
                  onChange={(e) => setLocationData({ ...locationData, name: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <input
                  type="text" placeholder="Street address"
                  value={locationData.address}
                  onChange={(e) => setLocationData({ ...locationData, address: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <div className="grid grid-cols-3 gap-3">
                  <input
                    type="text" placeholder="City"
                    value={locationData.city}
                    onChange={(e) => setLocationData({ ...locationData, city: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <input
                    type="text" placeholder="State"
                    value={locationData.state}
                    onChange={(e) => setLocationData({ ...locationData, state: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <input
                    type="text" placeholder="Zip"
                    value={locationData.zipCode}
                    onChange={(e) => setLocationData({ ...locationData, zipCode: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step: Team */}
          {step === 2 && (
            <div className="p-8">
              <div className="text-center mb-6">
                <Users className="w-10 h-10 text-blue-500 mx-auto mb-2" />
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Invite Your Team</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Add team members (you can skip this)</p>
              </div>
              <div className="space-y-3 max-h-[250px] overflow-y-auto">
                {teamMembers.map((member, idx) => (
                  <div key={idx} className="flex gap-2 items-start">
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <input
                        type="text" placeholder="First name"
                        value={member.firstName}
                        onChange={(e) => updateTeamMember(idx, 'firstName', e.target.value)}
                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none"
                      />
                      <input
                        type="email" placeholder="Email"
                        value={member.email}
                        onChange={(e) => updateTeamMember(idx, 'email', e.target.value)}
                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none"
                      />
                    </div>
                    {teamMembers.length > 1 && (
                      <button onClick={() => removeTeamMember(idx)} className="px-2 py-2 text-red-400 hover:text-red-600 text-sm">
                        &times;
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button onClick={addTeamMember} className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                <UserPlus className="w-4 h-4" /> Add Another
              </button>
            </div>
          )}

          {/* Step: Done */}
          {step === 3 && (
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-10 h-10 text-green-500" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">You're All Set!</h2>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                Your ARSHI workspace is ready. Start managing your car wash operations.
              </p>
              <div className="text-left bg-gray-50 dark:bg-gray-700 rounded-lg p-4 text-sm text-gray-600 dark:text-gray-300 space-y-1.5">
                <p><strong>Next steps:</strong></p>
                <p>1. Set up your shift schedule</p>
                <p>2. Create opening/closing checklists</p>
                <p>3. Add your equipment inventory</p>
                <p>4. Start tracking operations!</p>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="px-8 py-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
            {step > 0 && step < 3 ? (
              <button onClick={handleBack} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
            ) : (
              <div />
            )}
            <button
              onClick={handleNext}
              disabled={creating}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {creating ? 'Creating...' : step === 3 ? 'Go to Dashboard' : step === 2 ? 'Finish Setup' : 'Continue'}
              {!creating && step < 3 && <ArrowRight className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
