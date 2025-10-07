import React from 'react';
import { Outlet } from 'react-router-dom';
import TopNavbar from '../Navigation/TopNavbar';

const UserLayout = () => {
    return (
        <div className="user-layout">
            <TopNavbar />
            <main className="user-layout-content">
                <Outlet />
            </main>
        </div>
    );
};

export default UserLayout; 