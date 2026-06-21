import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Button,
  Divider,
  Dropdown,
  DropdownGroup,
  DropdownItem,
  DropdownList,
  Flex,
  FlexItem,
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
          <Flex
            alignItems={{ default: 'alignItemsCenter' }}
            spaceItems={{ default: 'spaceItemsSm' }}
            flexWrap={{ default: 'nowrap' }}
          >
            <FlexItem>
              <svg
                viewBox="0 0 193 145"
                xmlns="http://www.w3.org/2000/svg"
                height="28"
                aria-label="Red Hat logo"
              >
                <path
                  d="M127.47 83.49c12.51 0 30.61-2.58 30.61-17.46a14 14 0 00-.31-3.42l-7.45-32.36c-1.72-7.12-3.23-10.35-15.73-16.6C124.89 8.69 103.76.5 97.51.5 91.69.5 90 8 83.06 8c-6.68 0-11.64-5.6-17.89-5.6-6 0-9.91 4.09-12.93 12.5 0 0-8.41 23.72-9.49 27.16A6.43 6.43 0 0042.53 44c0 9.22 36.3 39.45 84.94 39.45M160 72.07c1.73 8.19 1.73 9.05 1.73 10.13 0 14-15.74 21.77-36.43 21.77C78.54 104 37.58 76.6 37.58 58.49a18.45 18.45 0 011.51-7.33C22.27 52 .5 55 .5 74.22c0 31.48 74.59 70.28 133.65 70.28 45.28 0 56.7-20.48 56.7-36.65 0-12.72-11-27.16-30.83-35.78"
                  fill="#e00"
                />
              </svg>
            </FlexItem>
            <FlexItem>
              <div style={{ lineHeight: 1.2, whiteSpace: 'nowrap' }}>
                <div
                  style={{
                    fontSize: '11px',
                    fontWeight: 400,
                  }}
                >
                  Red Hat
                </div>
                <div
                  style={{
                    fontSize: '14px',
                    fontWeight: 600,
                  }}
                >
                  OpenShift AI
                </div>
              </div>
            </FlexItem>
          </Flex>
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
    <Page masthead={masthead} sidebar={sidebar} isContentFilled>
      {children}
    </Page>
  );
}
