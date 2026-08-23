import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Header from '../components/Header';
import Home from '../pages/Home';
import * as api from '../lib/api';
import React from 'react';

vi.mock('../lib/api', () => ({
    apiSaveCampaign: vi.fn(),
    COMMON_HEADERS: () => ({}),
}));
vi.mock('../components/CampaignList', () => ({
    default: () => <div>Campaign List</div>
}));

describe('Demo Mode', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.clearAllMocks();
    });

    it('toggles demo mode via Header', () => {
        // Mock window.location.reload
        const originalReload = window.location.reload;
        Object.defineProperty(window, 'location', {
            value: { reload: vi.fn() },
            configurable: true
        });

        render(<BrowserRouter><Header /></BrowserRouter>);
        const checkbox = screen.getByLabelText(/Demo mode/i);
        expect(checkbox.checked).toBe(false);

        fireEvent.click(checkbox);
        expect(localStorage.getItem("studio_demo_mode")).toBe("true");
        expect(window.location.reload).toHaveBeenCalled();

        Object.defineProperty(window, 'location', { value: { reload: originalReload } });
    });

    it('loads Samsung demo campaign from Home', async () => {
        api.apiSaveCampaign.mockResolvedValue("mock-id");

        // Catch window.location.href
        const originalLocation = window.location;
        delete window.location;
        window.location = { href: '' };

        render(<BrowserRouter><Home /></BrowserRouter>);
        const loadBtn = screen.getByText(/Load Samsung demo campaign/i);
        fireEvent.click(loadBtn);

        expect(localStorage.getItem("studio_demo_mode")).toBe("true");

        // Give promises time to resolve
        await new Promise(r => setTimeout(r, 0));

        expect(api.apiSaveCampaign).toHaveBeenCalledWith(expect.objectContaining({
            name: "Samsung Demo Campaign",
            status: "ready"
        }));
        expect(window.location.href).toBe("/image/mock-id");

        window.location = originalLocation;
    });
});
