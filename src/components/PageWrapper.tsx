import React from 'react';
import MobileSectionHeader from './MobileSectionHeader';
import Card from './ui/Card';

interface PageWrapperProps {
    title: React.ReactNode;
    icon: string;
    children: React.ReactNode;
    description?: string;
}

const PageWrapper: React.FC<PageWrapperProps> = ({ title, icon, children, description }) => {
    return (
        <>
            <div className="md:hidden animate-fade-in-up">
                <MobileSectionHeader title={title} description={description} />
                <div className="mt-4">
                    {children}
                </div>
            </div>
            <div className="hidden md:block animate-fade-in-up">
                <Card title={title} icon={icon} description={description}>
                    {children}
                </Card>
            </div>
        </>
    );
};

export default PageWrapper;
