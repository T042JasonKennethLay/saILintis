export interface DashboardProps {
  activeItem: string;
  activeSection: string;
  setActiveItem: (value: string) => void;
  setActiveSection: (value: string) => void;
  children: React.ReactNode;
}
