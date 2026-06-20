import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Masthead,
  MastheadBrand,
  MastheadMain,
  MastheadToggle,
  Nav,
  NavExpandable,
  NavItem,
  NavList,
  Page,
  PageSidebar,
  PageSidebarBody,
  PageToggleButton,
} from '@patternfly/react-core';
import { BarsIcon } from '@patternfly/react-icons';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();

  const isAgentsActive =
    location.pathname === '/' || location.pathname.startsWith('/agents');

  const masthead = (
    <Masthead>
      <MastheadToggle>
        <PageToggleButton
          variant="plain"
          aria-label="Global navigation"
          isSidebarOpen={isSidebarOpen}
          onSidebarToggle={() => setIsSidebarOpen((prev) => !prev)}
        >
          <BarsIcon />
        </PageToggleButton>
      </MastheadToggle>
      <MastheadMain>
        <MastheadBrand>
          <span
            style={{
              fontSize: '14px',
              fontWeight: 600,
              lineHeight: '36px',
              whiteSpace: 'nowrap',
            }}
          >
            Red Hat OpenShift AI
          </span>
        </MastheadBrand>
      </MastheadMain>
    </Masthead>
  );

  const sidebar = (
    <PageSidebar isSidebarOpen={isSidebarOpen}>
      <PageSidebarBody>
        <Nav>
          <NavList>
            <NavItem isActive={false}>Home</NavItem>
            <NavItem isActive={false}>Projects</NavItem>
            <NavExpandable
              title="AI hub"
              isExpanded={true}
              isActive={isAgentsActive}
            >
              <NavItem
                isActive={isAgentsActive}
                onClick={() => navigate('/')}
              >
                Agents
              </NavItem>
              <NavItem isActive={false}>Models</NavItem>
            </NavExpandable>
            <NavExpandable title="Gen AI studio" isExpanded={false}>
              <NavItem isActive={false}>Placeholder</NavItem>
            </NavExpandable>
            <NavExpandable title="Develop and train" isExpanded={false}>
              <NavItem isActive={false}>Placeholder</NavItem>
            </NavExpandable>
            <NavExpandable title="Observe and monitor" isExpanded={false}>
              <NavItem isActive={false}>Placeholder</NavItem>
            </NavExpandable>
            <NavItem isActive={false}>Learning resources</NavItem>
            <NavExpandable title="Applications" isExpanded={false}>
              <NavItem isActive={false}>Placeholder</NavItem>
            </NavExpandable>
            <NavExpandable title="Settings" isExpanded={false}>
              <NavItem isActive={false}>Placeholder</NavItem>
            </NavExpandable>
          </NavList>
        </Nav>
      </PageSidebarBody>
    </PageSidebar>
  );

  return (
    <Page masthead={masthead} sidebar={sidebar}>
      {children}
    </Page>
  );
}
