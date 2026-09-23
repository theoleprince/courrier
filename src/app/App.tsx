import { RouterProvider } from 'react-router-dom';
import { router } from '@/app/router';
import { useAppliquerTheme } from '@/app/useAppliquerTheme';
import { Toasts } from '@/components/ui/Toasts';

export function App(): React.JSX.Element {
  useAppliquerTheme();
  return (
    <>
      <RouterProvider router={router} />
      <Toasts />
    </>
  );
}
