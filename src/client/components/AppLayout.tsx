import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Button,
  Divider,
  Dropdown,
  DropdownGroup,
  DropdownItem,
  DropdownList,
  Masthead,
  MastheadBrand,
  MastheadContent,
  MastheadMain,
  MastheadToggle,
  MenuToggle,
  Nav,
  NavExpandable,
  NavItem,
  NavList,
  Page,
  PageSidebar,
  PageSidebarBody,
  PageToggleButton,
  Toolbar,
  ToolbarContent,
  ToolbarGroup,
  ToolbarItem,
} from '@patternfly/react-core';
import {
  BarsIcon,
  BellIcon,
  BookOpenIcon,
  ChartLineIcon,
  CodeIcon,
  CogIcon,
  CubeIcon,
  FlaskIcon,
  FolderOpenIcon,
  HomeIcon,
  InfoCircleIcon,
  OutlinedMoonIcon,
  RobotIcon,
  UserIcon,
} from '@patternfly/react-icons';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const isAgentsActive =
    location.pathname === '/' || location.pathname.startsWith('/agents');

  const userAvatar = (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '28px',
        height: '28px',
        backgroundColor: 'var(--pf-t--global--color--brand--default)',
        borderRadius: '50%',
        color: 'white',
        fontSize: '14px',
      }}
    >
      <UserIcon />
    </span>
  );

  const userMenuToggle = (toggleRef: React.RefObject<HTMLButtonElement>) => (
    <MenuToggle
      ref={toggleRef as React.Ref<HTMLButtonElement>}
      onClick={() => setIsUserMenuOpen((prev) => !prev)}
      isExpanded={isUserMenuOpen}
      icon={userAvatar}
    >
      AI Engineer
    </MenuToggle>
  );

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
      <MastheadContent>
        <Toolbar isFullHeight isStatic>
          <ToolbarContent>
            <ToolbarGroup
              variant="action-group-plain"
              align={{ default: 'alignEnd' }}
            >
              <ToolbarItem>
                <Button
                  variant="plain"
                  aria-label="Notifications"
                  icon={<BellIcon />}
                />
              </ToolbarItem>
              <ToolbarItem>
                <Button
                  variant="plain"
                  aria-label="Info"
                  icon={<InfoCircleIcon />}
                />
              </ToolbarItem>
              <ToolbarItem>
                <Button
                  variant="plain"
                  aria-label="Dark mode"
                  icon={<OutlinedMoonIcon />}
                />
              </ToolbarItem>
            </ToolbarGroup>
            <ToolbarItem>
              <Dropdown
                isOpen={isUserMenuOpen}
                onSelect={() => setIsUserMenuOpen(false)}
                onOpenChange={setIsUserMenuOpen}
                toggle={userMenuToggle}
                popperProps={{ position: 'end' }}
              >
                <DropdownGroup key="roles">
                  <DropdownList>
                    <DropdownItem key="admin" icon={<UserIcon />}>
                      AI Admin
                    </DropdownItem>
                    <DropdownItem key="engineer" icon={<UserIcon />}>
                      AI Engineer
                    </DropdownItem>
                    <DropdownItem key="scientist" icon={<UserIcon />}>
                      Data Scientist
                    </DropdownItem>
                  </DropdownList>
                </DropdownGroup>
                <Divider />
                <DropdownGroup key="actions">
                  <DropdownList>
                    <DropdownItem key="profile" icon={<UserIcon />}>
                      Profile
                    </DropdownItem>
                    <DropdownItem key="settings" icon={<CogIcon />}>
                      Settings
                    </DropdownItem>
                  </DropdownList>
                </DropdownGroup>
              </Dropdown>
            </ToolbarItem>
          </ToolbarContent>
        </Toolbar>
      </MastheadContent>
    </Masthead>
  );

  const navTitle = (icon: React.ReactNode, text: string) => (
    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      {icon}
      {text}
    </span>
  );

  const sidebar = (
    <PageSidebar isSidebarOpen={isSidebarOpen}>
      <PageSidebarBody>
        <Nav>
          <NavList>
            <NavItem isActive={false} icon={<HomeIcon />}>
              Home
            </NavItem>
            <NavItem isActive={false} icon={<FolderOpenIcon />}>
              Projects
            </NavItem>
            <NavExpandable
              title={navTitle(<RobotIcon />, 'AI hub')}
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
            <NavExpandable
              title={navTitle(<FlaskIcon />, 'Gen AI studio')}
              isExpanded={false}
            >
              <NavItem isActive={false}>Placeholder</NavItem>
            </NavExpandable>
            <NavExpandable
              title={navTitle(<CodeIcon />, 'Develop and train')}
              isExpanded={false}
            >
              <NavItem isActive={false}>Placeholder</NavItem>
            </NavExpandable>
            <NavExpandable
              title={navTitle(<ChartLineIcon />, 'Observe and monitor')}
              isExpanded={false}
            >
              <NavItem isActive={false}>Placeholder</NavItem>
            </NavExpandable>
            <NavItem isActive={false} icon={<BookOpenIcon />}>
              Learning resources
            </NavItem>
            <NavExpandable
              title={navTitle(<CubeIcon />, 'Applications')}
              isExpanded={false}
            >
              <NavItem isActive={false}>Placeholder</NavItem>
            </NavExpandable>
            <NavExpandable
              title={navTitle(<CogIcon />, 'Settings')}
              isExpanded={false}
            >
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
