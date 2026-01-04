import React from 'react';
import PageWrapper from '../../components/PageWrapper';
import ProfileView from '../../components/ProfileView';
import { useStudentPanel } from '../../contexts/StudentPanelContext';

const StudentProfileView: React.FC = () => {
    const { studentDetails, isLoading, updateInternalNotes } = useStudentPanel();
    return (
        <PageWrapper
            icon="person"
            title={<span>Mi <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">Perfil</span></span>}
            description="Datos personales y academicos."
        >
            <ProfileView studentDetails={studentDetails} isLoading={isLoading} updateInternalNotes={updateInternalNotes} />
        </PageWrapper>
    );
};

export default StudentProfileView;
