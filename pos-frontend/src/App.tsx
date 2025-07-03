import React, { useState } from 'react';
import { AppContext } from './contexts/AppContext';
import { AuthProvider } from './contexts/AuthContext';
import { CashSessionProvider } from './contexts/CashSessionContext';
import { AppWrapper } from './AppWrapper';
import { Button } from './components/ui/Button';
import { Icon } from './components/ui/Icon';
import { X } from 'lucide-react';

interface GlobalModalState {
  isOpen: boolean;
  title: string;
  message: React.ReactNode;
  type: 'success' | 'error' | 'info' | 'confirm';
  onConfirm?: () => void;
}

const App: React.FC = () => {
    const [globalModalState, setGlobalModalState] = useState<GlobalModalState>({ isOpen: false, title: '', message: '', type: 'info' });

    const showModal = (title: string, message: React.ReactNode, type: 'success' | 'error' | 'info' | 'confirm' = 'info', onConfirm?: () => void) => {
        setGlobalModalState({ isOpen: true, title, message, type, onConfirm });
    };

    const closeModal = () => {
        setGlobalModalState(prev => ({ ...prev, isOpen: false }));
    };

    const handleConfirmModal = () => {
        if (globalModalState.onConfirm) {
            globalModalState.onConfirm();
        }
        closeModal();
    };

    return (
        <AppContext.Provider value={{ showModal }}>
            <AuthProvider>
                <CashSessionProvider>
                    <AppWrapper />
                </CashSessionProvider>
            </AuthProvider>
            
            {/* Global Modal Renderer */}
            {globalModalState.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md m-4">
                        <div className="flex justify-between items-center p-4 border-b">
                            <h3 className={`text-lg font-semibold ${globalModalState.type === 'success' ? 'text-green-600' : globalModalState.type === 'error' ? 'text-red-600' : 'text-gray-800'}`}>
                                {globalModalState.title}
                            </h3>
                            <Button variant="ghost" size="sm" onClick={closeModal}><Icon icon={X}/></Button>
                        </div>
                        <div className="p-5">{globalModalState.message}</div>
                        <div className="px-5 py-3 bg-gray-50 flex justify-end space-x-3">
                            {globalModalState.type === 'confirm' && (
                                <Button variant="secondary" onClick={closeModal}>Cancelar</Button>
                            )}
                            <Button onClick={globalModalState.type === 'confirm' ? handleConfirmModal : closeModal}>
                                {globalModalState.type === 'confirm' ? 'Confirmar' : 'Aceptar'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </AppContext.Provider>
    );
};

export default App;
