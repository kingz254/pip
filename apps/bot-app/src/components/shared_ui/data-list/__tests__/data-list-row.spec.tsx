import React from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DataListRow from '../data-list-row';

const LocationState = () => {
    const location = useLocation();
    return (
        <>
            <div data-testid='location-pathname'>{location.pathname}</div>
            <div data-testid='location-state'>{JSON.stringify(location.state)}</div>
        </>
    );
};

const renderRow = (destination_link?: string) =>
    render(
        <MemoryRouter initialEntries={['/']}>
            <Routes>
                <Route
                    path='/'
                    element={
                        <DataListRow
                            destination_link={destination_link}
                            row_key='123'
                            row={{}}
                            is_new_row={false}
                            is_scrolling={false}
                            rowRenderer={() => <span>Row content</span>}
                        />
                    }
                />
                <Route path='/contract/:id' element={<LocationState />} />
            </Routes>
        </MemoryRouter>
    );

describe('<DataListRow />', () => {
    it('[BTU-001] navigates to the destination link with from_table_row state when a linked row is clicked', async () => {
        renderRow('/contract/123');

        await userEvent.click(screen.getByRole('link'));

        expect(await screen.findByTestId('location-pathname')).toHaveTextContent(/^\/contract\/123$/);
        expect(screen.getByTestId('location-state')).toHaveTextContent('{"from_table_row":true}');
    });

    it('[BTU-001] renders the row content without a link when there is no destination link', () => {
        renderRow();

        expect(screen.queryByRole('link')).not.toBeInTheDocument();
        expect(screen.getByText('Row content')).toBeInTheDocument();
    });
});
